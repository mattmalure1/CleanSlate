// ============================================================
// offerEngine.js — Spec-aligned 11-step algorithm
//
// All prices in CENTS (integers). Pure JS (no TypeScript).
//
// Implements CLEANSLATE_DB_AND_ENGINE.md §2.2 exactly:
//   Step 1  — UPC -> ASIN resolution
//   Step 2  — Cache freshness check (data_age_days <= 30)
//   Step 3  — Hard rejection filters (hazmat/adult/oversize/blacklist/do_not_buy/inventory_cap)
//   Step 4  — Velocity check (sales_rank_drops_90 >= 4) + tier assignment
//   Step 5  — Price determination: MIN(current_buybox, avg_90_day_buybox) + volatility gate
//   Step 6  — Competition check (Amazon-on-listing, fba_offer_count)
//   Step 7  — Fee calculation (reads offer_engine_config)
//   Step 8  — Net resale value
//   Step 9  — Inventory throttling (MVP: always 1.00)
//   Step 10 — ROI floor + final offer
//   Step 11 — Sanity checks
//
// Every REJECT path populates the CalculationTrace with everything
// collected up to that point and sets rejection_step (1..11).
// ============================================================

const tt = require('./tierThresholds');

// ------------------------------------------------------------
// Hardcoded tables (spec §2.5, §2.6 — architectural rules, not
// tunable parameters, so not in offer_engine_config).
// ------------------------------------------------------------

// Category blacklist (case-insensitive substring match against category_tree joined)
const CATEGORY_BLACKLIST = [
  'textbook',
  'workbook',
  'solutions manual',
  'vhs',
  'cassette',
  'vinyl',
  'lp record',
  'coloring',
  'journal',
];

// Minimum viable working price by category
const CATEGORY_MIN_PRICE_CENTS = {
  book:   200,
  dvd:    250,
  bluray: 250,
  cd:     600,
  game:   500,
};

const DEFAULT_WEIGHT_GRAMS = 400;

// Oversize thresholds (mm / g) — spec §2.2 Step 3
const MAX_LENGTH_MM = 457; // 18 in
const MAX_WIDTH_MM  = 356; // 14 in
const MAX_HEIGHT_MM = 203; // 8 in
const MAX_WEIGHT_G  = 9072; // 20 lbs

// ------------------------------------------------------------
// Deprecated-param warning with dedup by caller stack frame.
// ------------------------------------------------------------
const _warnedCallers = new Set();
function warnDeprecated(paramName, value) {
  const stack = new Error().stack || '';
  // Line [2] in stack is the caller of the function that called warnDeprecated
  const key = (stack.split('\n')[3] || 'unknown').trim();
  if (_warnedCallers.has(key + ':' + paramName)) return;
  _warnedCallers.add(key + ':' + paramName);
  console.warn(
    `[offerEngine] Deprecated param "${paramName}"=${JSON.stringify(value)} ` +
    `passed from ${key} — ignored. See spec §4.1.`
  );
}

// ------------------------------------------------------------
// Keepa field extraction (spec §2.3)
// Normalizes raw Keepa product response -> KeepaExtractedFields
// Keepa convention: -1 means "no data".
// ------------------------------------------------------------
function extractKeepaFields(product) {
  const stats = product.stats || {};
  const cur   = stats.current || [];
  const avg90 = stats.avg90   || [];
  const min90 = stats.min90   || [];
  const max90 = stats.max90   || [];

  const nz = (v) => (v != null && v !== -1 ? v : null);

  // Category tree normalization: Keepa returns array of {catId,name}
  const categoryTree = Array.isArray(product.categoryTree)
    ? product.categoryTree.map(c => (c && c.name) || '').filter(Boolean)
    : [];

  // data_age_days: Keepa `lastUpdate` is minutes since Keepa epoch (2011-01-01)
  const KEEPA_EPOCH_MS = 1293840000000;
  let dataAgeDays = 0;
  if (product.lastUpdate && typeof product.lastUpdate === 'number') {
    const lastMs = KEEPA_EPOCH_MS + product.lastUpdate * 60000;
    dataAgeDays = Math.max(0, Math.floor((Date.now() - lastMs) / 86400000));
  }

  return {
    asin: product.asin || null,
    title: product.title || '',
    category_tree: categoryTree,
    category_root: null, // populated by detectCategory()

    // Prices (cents) — used-buybox anchor for buyback pricing.
    // NOTE: Keepa index 18 = New Buy Box Shipping (wrong for used resale).
    //       Keepa index 32 = Used Buy Box (what we actually want).
    // The spec §2.3 mapping was incorrect for a used-media buyback business
    // and said index 18; we override to 32 here and rename the fields to
    // current_used_buybox_cents / avg_90_day_used_buybox_cents / ... for clarity.
    current_used_buybox_cents:     nz(cur[32]),
    current_amazon_cents:          nz(cur[0]),
    current_new_3p_cents:          nz(cur[1]),
    avg_90_day_used_buybox_cents:  nz(avg90[32]),
    avg_180_day_used_buybox_cents: nz((stats.avg180 || [])[32]),
    min_90_day_used_cents:         nz(min90[32]),
    max_90_day_used_cents:         nz(max90[32]),

    // Rank
    current_bsr:      nz(cur[3]),
    avg_90_day_bsr:   nz(avg90[3]),

    // Velocity (spec §4.1 rule 3 — the primary signal)
    sales_rank_drops_30:  stats.salesRankDrops30  ?? 0,
    sales_rank_drops_90:  stats.salesRankDrops90  ?? 0,
    sales_rank_drops_180: stats.salesRankDrops180 ?? 0,

    // Competition
    new_offer_count: nz(cur[11]) ?? 0,
    fba_offer_count: product.newOffersFBA ?? 0,
    amazon_is_seller: (cur[0] != null && cur[0] !== -1),

    // Package dims
    package_height_mm: nz(product.packageHeight),
    package_length_mm: nz(product.packageLength),
    package_width_mm:  nz(product.packageWidth),
    package_weight_g:  nz(product.packageWeight) ?? nz(product.itemWeight),

    // Flags
    is_hazmat:   product.hazardousMaterialType != null && product.hazardousMaterialType !== 0,
    is_adult:    !!product.isAdultProduct,
    is_redirect: !!product.isRedirectASIN,

    data_age_days: dataAgeDays,
  };
}

// ------------------------------------------------------------
// Category detection (bluray-before-dvd ordering per Matt's direction)
//
// Rules:
//   1. Digital-only formats (Kindle, Audible, MP3, Prime/Instant/Amazon Video)
//      always return null — customer must ship physical media.
//   2. Physical-media detection in priority order (bluray before dvd).
//   3. Game detection requires the exact phrase "video games" — we never
//      match on bare "games" because that would catch "Toys & Games".
//   4. Book detection requires "books" AND no digital markers. Substrings
//      like "cookbooks" correctly match via the "books" substring.
// ------------------------------------------------------------
function detectCategory(categoryTree) {
  if (!Array.isArray(categoryTree) || categoryTree.length === 0) return null;
  const joined = categoryTree.join(' ').toLowerCase();

  // Gate 1: reject any digital-only format outright.
  // Checked BEFORE physical matches so Kindle/Audible/MP3/Prime Video
  // always return null even if the tree also mentions a physical category.
  if (joined.includes('kindle')) return null;
  if (joined.includes('audible')) return null;
  if (joined.includes('mp3')) return null;
  if (joined.includes('digital music')) return null;
  if (joined.includes('prime video')) return null;
  if (joined.includes('instant video')) return null;
  if (joined.includes('amazon video')) return null;

  // Gate 2: physical-media detection. Order matters: bluray before dvd
  // because Amazon nests "Movies & TV > Blu-ray > DVD" in category trees.
  if (joined.includes('blu-ray') || joined.includes('bluray')) return 'bluray';
  if (joined.includes('dvd')) return 'dvd';
  // Game requires the FULL phrase "video games" — bare "games" would
  // false-match "Toys & Games", "Board Games", etc.
  if (joined.includes('video games') || joined.includes('videogames')) return 'game';
  if (joined.includes('cds & vinyl') || joined.includes('cds and vinyl')) return 'cd';
  if (joined.includes('music') && joined.includes('cds')) return 'cd';
  // Book is last so digital-book markers have a chance to disqualify first.
  if (joined.includes('books')) return 'book';
  return null;
}

// ------------------------------------------------------------
// FBA fee lookup (spec §2.7)
// Returns cents. Assumes caller already filtered oversize at Step 3.
// ------------------------------------------------------------
function lookupFBAFee(weight_g, length_mm, width_mm, height_mm) {
  const weight_lbs = weight_g / 453.592;

  // Small Standard (spec §2.7)
  const isSmallStandard =
    weight_g <= 425 &&
    length_mm != null && length_mm <= 381 &&
    width_mm  != null && width_mm  <= 305 &&
    height_mm != null && height_mm <= 19;

  if (isSmallStandard) return 306;

  // Large Standard tiers (spec §2.7 MVP values)
  if (weight_lbs <= 1)  return 325;
  if (weight_lbs <= 2)  return 450;
  if (weight_lbs <= 3)  return 520;
  return 520 + Math.ceil((weight_lbs - 3) * 38);
}

// ------------------------------------------------------------
// Category blacklist check
// ------------------------------------------------------------
function hitsBlacklist(categoryTree) {
  if (!Array.isArray(categoryTree) || categoryTree.length === 0) return null;
  const joined = categoryTree.join(' ').toLowerCase();
  for (const term of CATEGORY_BLACKLIST) {
    if (joined.includes(term)) return term;
  }
  return null;
}

// ------------------------------------------------------------
// Gated-brand/ASIN check — reads from DB-loaded cache in
// tierThresholds.js (gated_items table). Falls back to hardcoded
// patterns if the table hasn't been loaded yet (e.g. in tests
// that don't inject gated items).
//
// Checks: ASIN exact match, then brand substring match against
// product.brand, product.manufacturer, and product.title.
// ------------------------------------------------------------

// Hardcoded fallbacks (only used if gated_items table is empty/missing).
// Once the migration is applied and items are in the DB, these are redundant.
const GATED_ASINS_FALLBACK = new Set();
const GATED_BRAND_FALLBACK = ['disney', 'studio ghibli', 'criterion collection'];

function isGated(product) {
  const dbAsins = tt.getGatedAsins();
  const dbBrands = tt.getGatedBrands();

  // Use DB-loaded lists if available, otherwise fallback
  const asinSet = dbAsins.size > 0 ? dbAsins : GATED_ASINS_FALLBACK;
  const brandList = dbBrands.length > 0 ? dbBrands : GATED_BRAND_FALLBACK;

  // ASIN exact match
  if (product.asin && asinSet.has(product.asin.toUpperCase())) {
    return { gated: true, reason: 'asin_blocked', brand: product.asin };
  }

  // Brand substring match against brand, manufacturer, title
  const searchFields = [
    (product.brand || '').toLowerCase(),
    (product.manufacturer || '').toLowerCase(),
    (product.title || '').toLowerCase(),
  ].join(' ');

  for (const pattern of brandList) {
    if (searchFields.includes(pattern)) {
      return { gated: true, reason: 'brand_gated', brand: pattern };
    }
  }

  return { gated: false };
}

// Legacy exports for backward compat (tests may reference these)
const GATED_ASINS = GATED_ASINS_FALLBACK;
const GATED_BRAND_PATTERNS = GATED_BRAND_FALLBACK.map(b => new RegExp(b, 'i'));

// ------------------------------------------------------------
// CalculationTrace builder (spec §2.1)
// ------------------------------------------------------------
function newTrace() {
  return {
    asin: null,
    category: null,
    keepa_fields: null,
    hard_rejections_checked: [],
    working_price_cents: null,
    working_price_source: null,
    volatility_ratio: null,
    velocity_signal: null,
    tier_assigned: null,
    fees_breakdown: null,
    net_resale_cents: null,
    roi_floor_applied: null,
    required_margin_cents: null,
    inventory_penalty_applied: 1.0,
    competition_penalty_applied: 1.0,
    final_offer_cents: null,
    rejection_step: null,
    rejection_reason_detail: null,
  };
}

function rejectWith(trace, step, reason, detail = null) {
  trace.rejection_step = step;
  trace.rejection_reason_detail = detail || reason;
  return {
    accepted: false,
    rejection_reason: reason,
    calculation_trace: trace,
    keepa_data_timestamp: new Date(),
  };
}

function acceptWith(trace, offerCents, tier, isPennyTier = false) {
  return {
    accepted: true,
    offer_cents: offerCents,
    tier,
    is_penny_tier: isPennyTier,
    calculation_trace: trace,
    keepa_data_timestamp: new Date(),
  };
}

// ------------------------------------------------------------
// The 11-step algorithm
//
// opts:
//   inventoryCount:   number, defaults to 0 (Step 3 cap check & Step 9 throttle)
//   doNotBuyMatch:    boolean, defaults to false (Step 3 cooldown check)
//   gatedResult:      object, result of isGated(rawProduct) if already computed
//
// Returns OfferEngineOutput per spec §2.1.
// ------------------------------------------------------------
function runOfferEngine(rawProduct, extractedFields, opts = {}) {
  const trace = newTrace();

  // ===== STEP 1: UPC -> ASIN resolution =====
  if (!extractedFields || !extractedFields.asin) {
    return rejectWith(trace, 1,
      "Barcode not recognized. Make sure you're scanning a physical book, DVD, Blu-ray, CD, or video game.");
  }
  trace.asin = extractedFields.asin;

  // ===== STEP 2: Data freshness =====
  if (extractedFields.data_age_days > 30) {
    trace.keepa_fields = extractedFields;
    return rejectWith(trace, 2, 'Insufficient recent data',
      `data_age_days=${extractedFields.data_age_days}`);
  }
  trace.keepa_fields = extractedFields;

  // ===== STEP 3: Hard rejection filters =====
  const checks = trace.hard_rejections_checked;

  checks.push('is_hazmat');
  if (extractedFields.is_hazmat) return rejectWith(trace, 3, 'Hazmat restricted');

  checks.push('is_adult');
  if (extractedFields.is_adult) return rejectWith(trace, 3, 'Adult content restricted');

  checks.push('is_redirect');
  if (extractedFields.is_redirect) return rejectWith(trace, 3, 'Listing deprecated');

  checks.push('package_dims');
  if (extractedFields.package_height_mm == null ||
      extractedFields.package_length_mm == null ||
      extractedFields.package_width_mm  == null ||
      extractedFields.package_weight_g  == null) {
    return rejectWith(trace, 3, 'Insufficient product data');
  }

  checks.push('oversize');
  if (extractedFields.package_length_mm > MAX_LENGTH_MM ||
      extractedFields.package_width_mm  > MAX_WIDTH_MM  ||
      extractedFields.package_height_mm > MAX_HEIGHT_MM) {
    return rejectWith(trace, 3, 'Oversize');
  }

  checks.push('overweight');
  if (extractedFields.package_weight_g > MAX_WEIGHT_G) {
    return rejectWith(trace, 3, 'Overweight');
  }

  checks.push('category_blacklist');
  const blacklistHit = hitsBlacklist(extractedFields.category_tree);
  if (blacklistHit) {
    return rejectWith(trace, 3, 'Category not accepted', `matched:${blacklistHit}`);
  }

  checks.push('gated_brand');
  const gated = opts.gatedResult || (rawProduct ? isGated(rawProduct) : { gated: false });
  if (gated.gated) {
    return rejectWith(trace, 3, 'Category not accepted', `gated:${gated.reason}`);
  }

  checks.push('do_not_buy');
  if (opts.doNotBuyMatch) {
    return rejectWith(trace, 3, 'Item on cooldown list');
  }

  checks.push('inventory_cap');
  const maxCopies = tt.getConfig('max_copies_per_asin');
  const invCount = opts.inventoryCount || 0;
  if (invCount >= maxCopies) {
    return rejectWith(trace, 3, 'We have enough of this item right now');
  }

  // ===== STEP 4: Category gate + velocity + tier =====

  // 4a: Category detection happens FIRST. If the category tree doesn't map
  // to one of our 5 supported physical-media categories, reject immediately
  // with a customer-facing message that explains what we DO buy. This runs
  // before the velocity check so a cereal-box scan gets the right reason
  // instead of confusing "low velocity" / "below tier thresholds" noise.
  const category = detectCategory(extractedFields.category_tree);
  if (!category) {
    return rejectWith(trace, 4,
      'We only buy books, DVDs, Blu-rays, CDs, and video games',
      `category_tree=${JSON.stringify(extractedFields.category_tree)}`);
  }
  extractedFields.category_root = category;
  trace.category = category;

  // 4b: Velocity check against the spec §4.1 rule 3 floor.
  const rankDrops90 = extractedFields.sales_rank_drops_90;
  trace.velocity_signal = rankDrops90;

  if (rankDrops90 < 4) {
    return rejectWith(trace, 4, 'Low velocity — sold fewer than 4 times in 90 days',
      `sales_rank_drops_90=${rankDrops90}`);
  }

  // 4c: Tier lookup + walking. Primary signal is rank drops; BSR ceiling
  // is the secondary gate per Matt's spec clarification.
  const tiers = tt.getTiersForCategory(category);
  if (!tiers || tiers.length === 0) {
    // Should never happen in production — every detectCategory output
    // has a matching seed row in tier_thresholds. Kept as a safety net.
    return rejectWith(trace, 4, 'Category not accepted', `no_tiers_for:${category}`);
  }

  // Walk tiers from strictest (T1) to loosest, assign first one we qualify for.
  // BSR is the secondary gate per Matt: rank drops primary, BSR as ceiling.
  let assignedTier = null;
  for (const tier of tiers) {
    if (rankDrops90 >= tier.min_rank_drops_90) {
      // Secondary BSR gate
      if (extractedFields.current_bsr != null &&
          extractedFields.current_bsr > tier.bsr_ceiling) {
        // Too deep in this tier's BSR range — try a lower tier
        continue;
      }
      assignedTier = tier;
      break;
    }
  }

  if (!assignedTier) {
    // Could be below min_rank_drops_90 threshold or BSR exceeded every tier
    return rejectWith(trace, 4, 'Below all tier thresholds',
      `drops90=${rankDrops90} bsr=${extractedFields.current_bsr}`);
  }
  trace.tier_assigned = assignedTier.tier;

  // ===== STEP 5: Price determination (the spec §4.1 rule 1 change) =====
  // Uses USED buy box (Keepa index 32), not new buy box — this is a used-media buyback.
  const currentPrice = extractedFields.current_used_buybox_cents ?? extractedFields.current_new_3p_cents;
  const avgPrice     = extractedFields.avg_90_day_used_buybox_cents;

  if (currentPrice == null || currentPrice <= 0) {
    return rejectWith(trace, 5, 'No active price');
  }
  if (avgPrice == null || avgPrice <= 0) {
    return rejectWith(trace, 5, 'Insufficient price history');
  }

  const volatility = Math.abs(currentPrice - avgPrice) / avgPrice;
  trace.volatility_ratio = volatility;

  if (volatility > 0.30) {
    return rejectWith(trace, 5, 'Price too volatile',
      `volatility_ratio=${volatility.toFixed(3)}`);
  }

  const workingPrice = Math.min(currentPrice, avgPrice);
  trace.working_price_cents = workingPrice;
  trace.working_price_source = (workingPrice === currentPrice) ? 'current_buybox' : 'avg_90_day';

  const minPrice = CATEGORY_MIN_PRICE_CENTS[category];
  if (workingPrice < minPrice) {
    return rejectWith(trace, 5, 'Sell price too low for viable margin',
      `working_price=${workingPrice} min=${minPrice}`);
  }

  // ===== STEP 6: Competition check (simplified) =====
  // Amazon-on-listing logic was REMOVED on 2026-04-10. CleanSlate sells
  // used inventory and prices against Keepa index 32 (used buy box).
  // Amazon almost always competes on the NEW buy box, not the used one,
  // so penalizing the used-side offer based on new-side competition was
  // logically inconsistent. The residual Amazon risk (Amazon crashes new
  // price -> crashes used price) is already caught by Step 5's 30%
  // volatility gate and Step 4's velocity floor — both fire the moment
  // the used-side numbers move. Inventory cap (10/ASIN) limits lag
  // exposure.
  //
  // extractedFields.amazon_is_seller is still extracted and stored in
  // trace.keepa_fields for debugger visibility but no longer gates or
  // penalizes anything here.
  let competitionPenalty = 1.0;
  if (extractedFields.fba_offer_count > 30 && workingPrice < 500) {
    return rejectWith(trace, 6, 'Too competitive, low price');
  } else if (extractedFields.fba_offer_count > 50) {
    competitionPenalty = 0.90;
  }
  trace.competition_penalty_applied = competitionPenalty;

  // ===== STEP 7: Fee calculation =====
  const referralRate     = tt.getConfig('referral_fee_rate');
  const closingFee       = tt.getConfig('closing_fee_cents');
  const prepCost         = tt.getConfig('prep_cost_cents');
  const inboundPerLb     = tt.getConfig('inbound_per_lb_cents');
  const mediaMailReceive = tt.getConfig('media_mail_receive_cents');
  const discBufferCfg    = tt.getConfig('disc_buffer_cents');
  const rejectionReturn  = tt.getConfig('rejection_return_overhead_cents');
  const storageReserve   = tt.getConfig('storage_reserve_cents');

  const referralFee = Math.floor(workingPrice * referralRate);

  const fbaFulfillmentFee = lookupFBAFee(
    extractedFields.package_weight_g,
    extractedFields.package_length_mm,
    extractedFields.package_width_mm,
    extractedFields.package_height_mm
  );

  const weightLbs = extractedFields.package_weight_g / 453.592;
  const inboundShipping = Math.max(25, Math.floor(weightLbs * inboundPerLb));

  const discBuffer = ['dvd', 'bluray', 'cd', 'game'].includes(category) ? discBufferCfg : 0;

  const totalFees = referralFee + closingFee + fbaFulfillmentFee + prepCost +
                    inboundShipping + mediaMailReceive + discBuffer +
                    rejectionReturn + storageReserve;

  trace.fees_breakdown = {
    referral_fee_cents:             referralFee,
    closing_fee_cents:              closingFee,
    fba_fulfillment_fee_cents:      fbaFulfillmentFee,
    prep_cost_cents:                prepCost,
    inbound_shipping_cents:         inboundShipping,
    media_mail_receive_cents:       mediaMailReceive,
    disc_buffer_cents:              discBuffer,
    rejection_return_overhead_cents: rejectionReturn,
    storage_reserve_cents:          storageReserve,
    total_fees_cents:               totalFees,
  };

  // ===== STEP 8: Net resale value =====
  const netResale = workingPrice - totalFees;
  trace.net_resale_cents = netResale;

  if (netResale <= 0) {
    return rejectWith(trace, 8, 'No margin after fees');
  }

  // ===== STEP 9: Inventory throttling (MVP: always 1.00) =====
  // Phase 2 wires actual inventory_on_hand throttling.
  trace.inventory_penalty_applied = 1.0;

  // ===== STEP 10: ROI floor + final offer =====
  const roiFloor = assignedTier.roi_floor_percent / 100;
  trace.roi_floor_applied = assignedTier.roi_floor_percent;

  const maxOfferCents = Math.floor(netResale / (1 + roiFloor));
  const requiredMargin = Math.max(
    assignedTier.min_flat_margin_cents,
    netResale - maxOfferCents
  );
  trace.required_margin_cents = requiredMargin;

  const offerBeforePenalties = netResale - requiredMargin;
  const withPenalties = offerBeforePenalties * competitionPenalty * trace.inventory_penalty_applied;
  const finalOffer = Math.floor(withPenalties / 5) * 5; // round down to nearest $0.05
  trace.final_offer_cents = finalOffer;

  // ===== STEP 11: Sanity checks + penny tier fallback =====
  if (finalOffer < 25) {
    // V2 Penny tier: if standard ROI math fails but we'd still net $0.50+
    // profit at a $0.10 offer, accept as penny tier. These are "bulk add"
    // items that ride along with featured items in the same shipping box.
    // The customer sees them as $0.10 bonus adds, not featured items.
    // Penny items are capped at 50% of cart value on the frontend.
    const PENNY_OFFER_CENTS = 10;
    const PENNY_MIN_NET_PROFIT_CENTS = 50;
    const pennyProfit = netResale - PENNY_OFFER_CENTS;
    if (pennyProfit >= PENNY_MIN_NET_PROFIT_CENTS) {
      trace.final_offer_cents = PENNY_OFFER_CENTS;
      trace.penny_tier_applied = true;
      trace.penny_net_profit_cents = pennyProfit;
      return acceptWith(trace, PENNY_OFFER_CENTS, assignedTier.tier, true);
    }
    return rejectWith(trace, 11, 'Margin too thin', `final_offer=${finalOffer}, penny_profit=${pennyProfit}`);
  }
  if (finalOffer > workingPrice * 0.50) {
    console.error('[offerEngine] Calculation error — offer exceeds 50% of working price', {
      asin: extractedFields.asin, workingPrice, finalOffer,
    });
    return rejectWith(trace, 11, 'Engine calculation error',
      `offer=${finalOffer} > 50%_of_${workingPrice}`);
  }

  trace.penny_tier_applied = false;
  return acceptWith(trace, finalOffer, assignedTier.tier, false);
}

// ------------------------------------------------------------
// Legacy wrapper — preserves the old calculateOffer() signature
// so existing routes (quote.js, admin.js) keep working without
// modification beyond the engine refactor itself.
//
// Builds a legacy _debug payload from the new calculation_trace.
// ------------------------------------------------------------

/**
 * @deprecated condition param — retained for API compatibility.
 * The engine now uses blended buybox pricing per spec §4.1.
 * This parameter is ignored and will be removed in a future sprint.
 *
 * @deprecated pricingMode param — same story. The old scouting vs buyback
 * bifurcation is gone; the engine produces a single spec-compliant offer.
 *
 * TODO: Remove condition and pricingMode params after all callers updated
 * (tracked for cleanup sprint).
 */
function calculateOffer(product, hasCase = true, pricingMode = 'buyback', condition = null, _precomputed = null) {
  if (pricingMode && pricingMode !== 'buyback') warnDeprecated('pricingMode', pricingMode);
  if (condition != null) warnDeprecated('condition', condition);

  // Accept precomputed engine result to avoid running the 11-step algorithm twice.
  // Callers that already ran runOfferEngine() pass { extracted, gatedResult, engineResult }.
  const extracted = _precomputed?.extracted || extractKeepaFields(product);
  const gatedResult = _precomputed?.gatedResult || isGated(product);
  const result = _precomputed?.engineResult || runOfferEngine(product, extracted, { gatedResult });

  const category = extracted.category_root || result.calculation_trace?.category || null;
  const isDisc = ['dvd', 'bluray', 'cd', 'game'].includes(category);

  const meta = {
    title: product.title || 'Unknown Item',
    asin: extracted.asin,
    imageUrl: product.imagesCSV
      ? `https://images-na.ssl-images-amazon.com/images/I/${product.imagesCSV.split(',')[0]}`
      : null,
    category,
    isDisc,
    hasCase,
  };

  // Build legacy _debug shape that admin.js reads.
  // Fields admin.js uses: sellPrice, priceSource, fees, profitAnalysis, velocity, weightLbs
  const trace = result.calculation_trace;
  const _debug = buildLegacyDebug(trace, extracted, result);

  if (!result.accepted) {
    return {
      ...meta,
      status: 'rejected',
      reason: result.rejection_reason || 'unknown',
      message: humanizeRejection(result.rejection_reason),
      offerCents: 0,
      offerDisplay: '$0.00',
      _debug,
    };
  }

  const offerCents = result.offer_cents;
  let status, color, label;
  if (result.is_penny_tier) {
    status = 'penny'; color = 'amber'; label = 'Bulk Add $0.10';
  } else if (offerCents >= 150) {
    status = 'accepted'; color = 'green'; label = "We'll Buy This!";
  } else {
    status = 'low'; color = 'yellow'; label = 'Low Offer';
  }

  return {
    ...meta,
    status,
    color,
    label,
    offerCents,
    offerDisplay: `$${(offerCents / 100).toFixed(2)}`,
    tier: result.tier,
    _debug,
  };
}

function buildLegacyDebug(trace, extracted, result) {
  const fees = trace.fees_breakdown || {};
  const workingPrice = trace.working_price_cents;
  const netResale = trace.net_resale_cents;
  const finalOffer = trace.final_offer_cents || 0;

  // Rough ROI for display (admin profit panel)
  const ourProfit = netResale != null && finalOffer > 0
    ? netResale - finalOffer
    : 0;
  const roi = finalOffer > 0 ? Math.round((ourProfit / finalOffer) * 100) : 0;
  const profitMargin = workingPrice && workingPrice > 0 && ourProfit != null
    ? Math.round((ourProfit / workingPrice) * 100)
    : 0;

  return {
    // Legacy fields admin.js reads
    sellPrice: workingPrice,
    priceSource: trace.working_price_source
      ? { selected: trace.working_price_source, selectedPrice: workingPrice }
      : null,
    weightLbs: extracted.package_weight_g != null
      ? Math.round((extracted.package_weight_g / 453.592) * 100) / 100
      : null,
    keepaFbaFee: fees.fba_fulfillment_fee_cents ?? null,
    fees: {
      referralFee:   fees.referral_fee_cents ?? 0,
      closingFee:    fees.closing_fee_cents ?? 0,
      fbaFee:        fees.fba_fulfillment_fee_cents ?? 0,
      prepFee:       fees.prep_cost_cents ?? 0,
      inboundShip:   fees.inbound_shipping_cents ?? 0,
      customerShip:  fees.media_mail_receive_cents ?? 0,
      discBuffer:    fees.disc_buffer_cents ?? 0,
      amazonFees: (fees.referral_fee_cents ?? 0) + (fees.closing_fee_cents ?? 0) + (fees.fba_fulfillment_fee_cents ?? 0),
      ourCosts: (fees.prep_cost_cents ?? 0) + (fees.inbound_shipping_cents ?? 0) + (fees.media_mail_receive_cents ?? 0) + (fees.disc_buffer_cents ?? 0) + (fees.rejection_return_overhead_cents ?? 0) + (fees.storage_reserve_cents ?? 0),
      profitPool: netResale,
      totalDeductions: workingPrice != null ? workingPrice - finalOffer : null,
    },
    profitAnalysis: {
      ourProfit,
      roi,
      roiFloor: trace.roi_floor_applied,
      profitMargin,
      buySignal: result.accepted ? 'BUY' : 'PASS',
      meetsTargetProfit: result.accepted,
      meetsROI: result.accepted,
      requiredMarginCents: trace.required_margin_cents,
    },
    velocity: {
      salesRankDrops90: extracted.sales_rank_drops_90,
      salesRankDrops180: extracted.sales_rank_drops_180,
      salesRankDrops30: extracted.sales_rank_drops_30,
      salesRank: extracted.current_bsr,
      source: 'sales_rank_drops_90',
    },
    competitionAdjustment: {
      fbaOfferCount: extracted.fba_offer_count,
      amazonOnListing: extracted.amazon_is_seller,
      penaltyApplied: trace.competition_penalty_applied,
    },
    // Full trace (for quote_items logging + future Quote Debugger)
    calculation_trace: trace,
    rejection_step: trace.rejection_step,
  };
}

// Map internal rejection reasons to customer-friendly messages.
// If the reason is already a full customer-facing sentence (ends in a
// period), we pass it through unchanged — that's the case for the new
// Step 1 and Step 4 category-gate messages.
function humanizeRejection(reason) {
  if (!reason) return "Sorry, we can't make an offer on this item right now.";
  // Pass-through for reasons that are already full customer sentences
  // (the new Step 1 barcode-not-recognized message ends in a period).
  if (/[.!?]$/.test(reason)) return reason;
  const map = {
    'We only buy books, DVDs, Blu-rays, CDs, and video games':
      'Sorry, we only buy books, DVDs, Blu-rays, CDs, and video games.',
    'Insufficient recent data': "Sorry, we don't have enough recent data on this item.",
    'Hazmat restricted': 'Sorry, we cannot accept hazmat items.',
    'Adult content restricted': 'Sorry, we do not accept adult content.',
    'Listing deprecated': "Sorry, the listing for this item is no longer active.",
    'Insufficient product data': "Sorry, we don't have enough data on this item.",
    'Oversize': 'Sorry, this item is too large for our shipping program.',
    'Overweight': 'Sorry, this item is too heavy for our shipping program.',
    'Category not accepted': 'Sorry, we only accept books, DVDs, Blu-rays, CDs, and video games.',
    'Item on cooldown list': "Sorry, we can't accept this item right now.",
    'We have enough of this item right now': "Sorry, we have enough of this item right now.",
    'Low velocity — sold fewer than 4 times in 90 days': "Sorry, there's not enough demand for this item.",
    'Below all tier thresholds': "Sorry, there's not enough demand for this item.",
    'No active price': "Sorry, we can't find a current price for this item.",
    'Insufficient price history': "Sorry, we don't have enough pricing history on this item.",
    'Price too volatile': "Sorry, this item's price is too unstable right now.",
    'Sell price too low for viable margin': 'Sorry, the resale value is too low.',
    'Too competitive, low price': "Sorry, this item is too competitive.",
    'No margin after fees': 'Sorry, the resale value is too low for us to make an offer.',
    'Margin too thin': 'Sorry, the resale value is too low for us to make an offer.',
    'Engine calculation error': "Sorry, we hit an error pricing this item. Please try again.",
  };
  return map[reason] || "Sorry, we can't accept this item.";
}

// ------------------------------------------------------------
// Removed-exports stubs — throw loudly so forgotten callers surface
// ------------------------------------------------------------
function _removed(name) {
  return () => {
    throw new Error(
      `[offerEngine] ${name}() was removed in the 2026-04-10 spec alignment refactor. ` +
      `Use runOfferEngine() or calculateOffer() instead. See docs/CLEANSLATE_DB_AND_ENGINE.md.`
    );
  };
}

module.exports = {
  // New spec-aligned exports
  runOfferEngine,
  extractKeepaFields,
  detectCategory,
  isGated,
  lookupFBAFee,
  newTrace,
  CATEGORY_BLACKLIST,
  CATEGORY_MIN_PRICE_CENTS,
  GATED_ASINS,
  GATED_BRAND_PATTERNS,

  // Legacy wrapper still working (admin.js + quote.js)
  calculateOffer,

  // Removed — throw on call
  getTrigger:           _removed('getTrigger'),
  getSellPriceSource:   _removed('getSellPriceSource'),
  getSlotPrice:         _removed('getSlotPrice'),
  getUsedSlotPrice:     _removed('getUsedSlotPrice'),
  getAllConditionPrices:_removed('getAllConditionPrices'),
  getAverageUsedPrice:  _removed('getAverageUsedPrice'),
  getFbaUsedAvgPrice:   _removed('getFbaUsedAvgPrice'),
  getTargetProfit:      _removed('getTargetProfit'),
  getVelocity:          _removed('getVelocity'),
  getFbaFee:            _removed('getFbaFee'),
  getKeepaFbaFee:       _removed('getKeepaFbaFee'),
  getMediaMailCost:     _removed('getMediaMailCost'),
  getSellPrice:         _removed('getSellPrice'),
  TRIGGERS:             null, // consumers reading TRIGGERS will get null and can be updated to getTiersForCategory
};

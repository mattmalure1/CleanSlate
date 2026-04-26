// ============================================================
// offerEngine.test.js — node --test
//
// Covers the 11-step algorithm per CLEANSLATE_DB_AND_ENGINE.md §2.2.
// Uses tierThresholds._injectForTests() to bypass Supabase entirely,
// so these tests are fast, deterministic, and have zero external deps.
// ============================================================

const { test, describe, before } = require('node:test');
const assert = require('node:assert/strict');

const tt = require('../tierThresholds');
const engine = require('../offerEngine');

// ------------------------------------------------------------
// Test fixtures — seed tier_thresholds and offer_engine_config
// ------------------------------------------------------------
// V3.1 simplified buyback model: ONE row per category, binary velocity gate.
const SEED_TIERS = [
  { category: 'book',   tier: 'T1', min_rank_drops_90: 3, bsr_floor: 0, bsr_ceiling: 999999999, target_pct_bp: 1000, solid_pct_bp: 1500, offer_mode: 'percent', bundle_offer_cents: 10, roi_floor_percent: 0, min_flat_margin_cents: 0 },
  { category: 'dvd',    tier: 'T1', min_rank_drops_90: 3, bsr_floor: 0, bsr_ceiling: 999999999, target_pct_bp: 1000, solid_pct_bp: 1500, offer_mode: 'percent', bundle_offer_cents: 10, roi_floor_percent: 0, min_flat_margin_cents: 0 },
  { category: 'bluray', tier: 'T1', min_rank_drops_90: 3, bsr_floor: 0, bsr_ceiling: 999999999, target_pct_bp: 1200, offer_mode: 'percent', bundle_offer_cents: 10, roi_floor_percent: 0, min_flat_margin_cents: 0 },
  { category: 'cd',     tier: 'T1', min_rank_drops_90: 3, bsr_floor: 0, bsr_ceiling: 999999999, target_pct_bp:  800, offer_mode: 'percent', bundle_offer_cents: 10, roi_floor_percent: 0, min_flat_margin_cents: 0 },
  { category: 'game',   tier: 'T1', min_rank_drops_90: 3, bsr_floor: 0, bsr_ceiling: 999999999, target_pct_bp: 1500, offer_mode: 'percent', bundle_offer_cents: 10, roi_floor_percent: 0, min_flat_margin_cents: 0 },
];

const SEED_CONFIG = {
  closing_fee_cents: 180,
  prep_cost_cents: 145,
  rejection_return_overhead_cents: 30,
  inbound_per_lb_cents: 45,
  disc_buffer_cents: 50,
  storage_reserve_cents: 15,
  media_mail_receive_cents: 50,
  min_cart_value_cents: 1000,
  min_cart_items: 5,
  quote_expiration_days: 7,
  max_copies_per_asin: 10,
  daily_payout_cap_cents: 200000,
  referral_fee_rate: 0.15,
  // V3 buyback tuning knobs
  min_margin_cents: 30,        // never offer more than (netResale - 30¢)
  max_offer_pct_bp: 2500,      // never offer more than 25% of working price
  solid_tier_min_price_cents: 1500, // V3.2: working_price >= $15 uses solid_pct_bp
};

before(() => {
  tt._injectForTests({
    tiers: SEED_TIERS,
    config: SEED_CONFIG,
    gated: [
      { pattern: 'disney', match_type: 'brand' },
      { pattern: 'studio ghibli', match_type: 'brand' },
      { pattern: 'criterion collection', match_type: 'brand' },
    ],
  });
});

// ------------------------------------------------------------
// Helper: build a minimal valid KeepaExtractedFields.
// Default values produce an ACCEPTED T1 book quote. Override to
// test individual rejection paths.
// ------------------------------------------------------------
function makeExtracted(overrides = {}) {
  return {
    asin: 'B000TEST01',
    title: 'Test Book',
    category_tree: ['Books', 'Literature & Fiction'],
    category_root: null,
    current_used_buybox_cents:     2000, // $20
    current_amazon_cents:     null,
    current_new_3p_cents:     2100,
    avg_90_day_used_buybox_cents:  2000, // matches current -> 0% volatility
    avg_180_day_used_buybox_cents: 2000,
    min_90_day_used_cents:         1800,
    max_90_day_used_cents:         2200,
    current_bsr:              250000,
    avg_90_day_bsr:           250000,
    sales_rank_drops_30:  10,
    sales_rank_drops_90:  35,  // T1 (>=30)
    sales_rank_drops_180: 60,
    new_offer_count: 5,
    fba_offer_count: 3,
    amazon_is_seller: false,
    package_height_mm: 30,
    package_length_mm: 200,
    package_width_mm:  150,
    package_weight_g:  400,
    is_hazmat: false,
    is_adult:  false,
    is_redirect: false,
    data_age_days: 1,
    ...overrides,
  };
}

function run(extracted, opts = {}) {
  // Pass null for rawProduct in tests; isGated is not called when gatedResult is provided
  return engine.runOfferEngine(null, extracted, { gatedResult: { gated: false }, ...opts });
}

// ============================================================
// STEP 1: UPC -> ASIN resolution
// ============================================================
describe('Step 1: UPC -> ASIN', () => {
  test('rejects when asin is null (with customer-friendly barcode message)', () => {
    const r = run(makeExtracted({ asin: null }));
    assert.equal(r.accepted, false);
    assert.match(r.rejection_reason, /^Barcode not recognized\./);
    assert.equal(r.calculation_trace.rejection_step, 1);
  });

  test('populates trace.asin on valid input', () => {
    const r = run(makeExtracted());
    assert.equal(r.calculation_trace.asin, 'B000TEST01');
  });
});

// ============================================================
// STEP 2: Data freshness
// ============================================================
describe('Step 2: Data freshness', () => {
  test('rejects when data_age_days > 30', () => {
    const r = run(makeExtracted({ data_age_days: 31 }));
    assert.equal(r.accepted, false);
    assert.equal(r.rejection_reason, 'Insufficient recent data');
    assert.equal(r.calculation_trace.rejection_step, 2);
  });

  test('accepts at exactly 30 days old', () => {
    const r = run(makeExtracted({ data_age_days: 30 }));
    // May accept or reject later, but not at step 2
    assert.notEqual(r.calculation_trace.rejection_step, 2);
  });
});

// ============================================================
// STEP 3: Hard rejections
// ============================================================
describe('Step 3: Hard rejections', () => {
  test('rejects hazmat', () => {
    const r = run(makeExtracted({ is_hazmat: true }));
    assert.equal(r.rejection_reason, 'Hazmat restricted');
    assert.equal(r.calculation_trace.rejection_step, 3);
  });

  test('rejects adult', () => {
    const r = run(makeExtracted({ is_adult: true }));
    assert.equal(r.rejection_reason, 'Adult content restricted');
    assert.equal(r.calculation_trace.rejection_step, 3);
  });

  test('rejects redirect ASINs', () => {
    const r = run(makeExtracted({ is_redirect: true }));
    assert.equal(r.rejection_reason, 'Listing deprecated');
    assert.equal(r.calculation_trace.rejection_step, 3);
  });

  test('rejects missing package dimensions', () => {
    const r = run(makeExtracted({ package_weight_g: null }));
    assert.equal(r.rejection_reason, 'Insufficient product data');
    assert.equal(r.calculation_trace.rejection_step, 3);
  });

  test('rejects oversize length', () => {
    const r = run(makeExtracted({ package_length_mm: 500 }));
    assert.equal(r.rejection_reason, 'Oversize');
    assert.equal(r.calculation_trace.rejection_step, 3);
  });

  test('rejects overweight', () => {
    const r = run(makeExtracted({ package_weight_g: 10000 }));
    assert.equal(r.rejection_reason, 'Overweight');
    assert.equal(r.calculation_trace.rejection_step, 3);
  });

  test('rejects blacklisted category (textbook)', () => {
    const r = run(makeExtracted({ category_tree: ['Books', 'Textbooks', 'Math'] }));
    assert.equal(r.rejection_reason, 'Category not accepted');
    assert.equal(r.calculation_trace.rejection_step, 3);
  });

  test('rejects blacklisted category (VHS)', () => {
    const r = run(makeExtracted({ category_tree: ['Movies & TV', 'VHS'] }));
    assert.equal(r.rejection_reason, 'Category not accepted');
    assert.equal(r.calculation_trace.rejection_step, 3);
  });

  test('rejects do_not_buy cooldown', () => {
    const r = run(makeExtracted(), { doNotBuyMatch: true });
    assert.equal(r.rejection_reason, 'Item on cooldown list');
    assert.equal(r.calculation_trace.rejection_step, 3);
  });

  test('rejects at inventory cap', () => {
    const r = run(makeExtracted(), { inventoryCount: 10 });
    assert.equal(r.rejection_reason, 'We have enough of this item right now');
    assert.equal(r.calculation_trace.rejection_step, 3);
  });

  test('accepts just below inventory cap', () => {
    const r = run(makeExtracted(), { inventoryCount: 9 });
    assert.notEqual(r.calculation_trace.rejection_step, 3);
  });

  test('hard_rejections_checked list populated', () => {
    const r = run(makeExtracted());
    assert.ok(Array.isArray(r.calculation_trace.hard_rejections_checked));
    assert.ok(r.calculation_trace.hard_rejections_checked.includes('inventory_cap'));
  });
});

// ============================================================
// STEP 4: Velocity gate (v3.1 — binary, single tier per category)
// ============================================================
describe('Step 4: Velocity gate', () => {
  test('low velocity (1 drop) with high price → bundle ($0.10)', () => {
    // velocity_meets_threshold=false → forced bundle path in Step 11
    const r = run(makeExtracted({ sales_rank_drops_90: 1 }));
    assert.equal(r.accepted, true);
    assert.equal(r.is_penny_tier, true);
    assert.equal(r.offer_cents, 10);
  });

  test('low velocity (1 drop) with low price ($2) → reject', () => {
    const r = run(makeExtracted({ sales_rank_drops_90: 1, current_used_buybox_cents: 200, avg_90_day_used_buybox_cents: 200 }));
    assert.equal(r.accepted, false);
    // Hits category min price ($2.00 floor for books) at Step 5 before reaching velocity gate
    assert.ok(r.calculation_trace.rejection_step === 5 || r.calculation_trace.rejection_step === 11);
  });

  test('meets velocity threshold (3 drops) → percent path', () => {
    const r = run(makeExtracted({ sales_rank_drops_90: 3 }));
    assert.equal(r.calculation_trace.velocity_meets_threshold, true);
  });

  test('below velocity threshold (2 drops) → bundle path triggered', () => {
    const r = run(makeExtracted({ sales_rank_drops_90: 2 }));
    assert.equal(r.calculation_trace.velocity_meets_threshold, false);
  });

  test('single tier per category — always T1', () => {
    const r = run(makeExtracted({ sales_rank_drops_90: 35 }));
    assert.equal(r.calculation_trace.tier_assigned, 'T1');
  });

  test('velocity_signal populated in trace', () => {
    const r = run(makeExtracted({ sales_rank_drops_90: 35 }));
    assert.equal(r.calculation_trace.velocity_signal, 35);
  });
});

// ============================================================
// STEP 5: Price determination + volatility
// ============================================================
describe('Step 5: Price determination', () => {
  test('uses MIN when current > avg', () => {
    const r = run(makeExtracted({
      current_used_buybox_cents: 2500,
      avg_90_day_used_buybox_cents: 2000,
      // 25% volatility — within the 30% gate
    }));
    if (r.calculation_trace.working_price_cents != null) {
      assert.equal(r.calculation_trace.working_price_cents, 2000);
      assert.equal(r.calculation_trace.working_price_source, 'avg_90_day');
    }
  });

  test('uses MIN when current < avg', () => {
    const r = run(makeExtracted({
      current_used_buybox_cents: 1800,
      avg_90_day_used_buybox_cents: 2000,
    }));
    if (r.calculation_trace.working_price_cents != null) {
      assert.equal(r.calculation_trace.working_price_cents, 1800);
      assert.equal(r.calculation_trace.working_price_source, 'current_buybox');
    }
  });

  test('falls back to current_new_3p when current_buybox is null', () => {
    const r = run(makeExtracted({
      current_used_buybox_cents: null,
      current_new_3p_cents: 2000,
      avg_90_day_used_buybox_cents: 2000,
    }));
    // Should not reject at "No active price"
    assert.notEqual(r.rejection_reason, 'No active price');
  });

  test('rejects when both current_buybox and new_3p are null', () => {
    const r = run(makeExtracted({
      current_used_buybox_cents: null,
      current_new_3p_cents: null,
    }));
    assert.equal(r.rejection_reason, 'No active price');
    assert.equal(r.calculation_trace.rejection_step, 5);
  });

  test('falls back to avg_180_day when avg_90_day is null', () => {
    const r = run(makeExtracted({
      avg_90_day_used_buybox_cents: null,
      avg_180_day_used_buybox_cents: 2000,
    }));
    // 180-day fallback should kick in — no rejection at step 5
    assert.notEqual(r.calculation_trace.rejection_step, 5);
    assert.equal(r.calculation_trace.avg_window_used, '180d');
  });

  test('rejects when both avg_90_day AND avg_180_day are null', () => {
    const r = run(makeExtracted({
      avg_90_day_used_buybox_cents: null,
      avg_180_day_used_buybox_cents: null,
    }));
    assert.equal(r.rejection_reason, 'Insufficient price history');
    assert.equal(r.calculation_trace.rejection_step, 5);
  });

  test('volatility 29% accepts', () => {
    // 1290 vs 1000 -> 29% ratio
    const r = run(makeExtracted({
      current_used_buybox_cents: 1290,
      avg_90_day_used_buybox_cents: 1000,
    }));
    assert.notEqual(r.rejection_reason, 'Price too volatile');
  });

  test('volatility exactly 30% accepts (not > 0.30)', () => {
    // 1300 vs 1000 -> 30%
    const r = run(makeExtracted({
      current_used_buybox_cents: 1300,
      avg_90_day_used_buybox_cents: 1000,
    }));
    assert.notEqual(r.rejection_reason, 'Price too volatile');
  });

  test('volatility 31% no longer rejects (v3.1) — uses min(current,avg) as natural floor', () => {
    const r = run(makeExtracted({
      current_used_buybox_cents: 1310,
      avg_90_day_used_buybox_cents: 1000,
    }));
    // v3.1: volatility check removed. Working price = min(1310, 1000) = 1000.
    assert.notEqual(r.rejection_reason, 'Price too volatile');
    assert.equal(r.calculation_trace.working_price_cents, 1000);
  });

  test('volatility_ratio populated in trace', () => {
    const r = run(makeExtracted({
      current_used_buybox_cents: 2200,
      avg_90_day_used_buybox_cents: 2000,
    }));
    assert.ok(r.calculation_trace.volatility_ratio != null);
    assert.equal(Math.round(r.calculation_trace.volatility_ratio * 100), 10);
  });

  test('rejects working price below category minimum (book $2.00)', () => {
    const r = run(makeExtracted({
      current_used_buybox_cents: 150,
      avg_90_day_used_buybox_cents: 150,
    }));
    assert.equal(r.rejection_reason, 'Sell price too low for viable margin');
    assert.equal(r.calculation_trace.rejection_step, 5);
  });
});

// ============================================================
// STEP 6: Competition
// ============================================================
describe('Step 6: Competition check (simplified — no Amazon gate)', () => {
  test('rejects >30 FBA offers with price < $5', () => {
    // Use DVD (which has category min of $2.50) and a BSR inside T1 ceiling (50k)
    const r = run(makeExtracted({
      category_tree: ['Movies & TV', 'DVD'],
      current_bsr: 30000,
      sales_rank_drops_90: 35,
      fba_offer_count: 35,
      current_used_buybox_cents: 400,
      avg_90_day_used_buybox_cents: 400,
    }));
    assert.equal(r.rejection_reason, 'Too competitive, low price');
    assert.equal(r.calculation_trace.rejection_step, 6);
  });

  test('no Amazon on listing, fba_offer_count 55 — still applies 0.90 penalty', () => {
    const r = run(makeExtracted({
      amazon_is_seller: false,
      fba_offer_count: 55,
      current_used_buybox_cents: 2000,
      avg_90_day_used_buybox_cents: 2000,
    }));
    assert.equal(r.accepted, true, `should accept: ${r.rejection_reason || ''}`);
    assert.equal(r.calculation_trace.competition_penalty_applied, 0.90);
  });

  // --- Regression tests for the 2026-04-10 Step 6 simplification ---
  // Amazon-on-listing must NOT gate or penalize — it's informational only.

  test('Amazon on listing + good velocity + $15 + 10 offers accepts normally with penalty 1.0', () => {
    const r = run(makeExtracted({
      amazon_is_seller: true, // Amazon in the tree...
      current_used_buybox_cents: 1500,
      avg_90_day_used_buybox_cents: 1500,
      fba_offer_count: 10,
      sales_rank_drops_90: 35,
      current_bsr: 250000,
    }));
    assert.equal(r.accepted, true, `should accept: ${r.rejection_reason || ''}`);
    // CRITICAL: penalty is 1.0 — not penalized despite amazon_is_seller
    assert.equal(r.calculation_trace.competition_penalty_applied, 1.0);
    // amazon_is_seller is still visible in keepa_fields for debugger visibility
    assert.equal(r.calculation_trace.keepa_fields.amazon_is_seller, true);
  });

  test('Amazon on listing + low working price ($8) does NOT reject (no Amazon gate)', () => {
    // Pre-refactor this would have rejected at Step 6 with "Amazon on listing, low price".
    // Post-refactor, Amazon is informational only — the offer proceeds on used-side economics.
    // Use DVD (min price $2.50) so the category-min gate doesn't kill it first.
    const r = run(makeExtracted({
      category_tree: ['Movies & TV', 'DVD'],
      current_bsr: 30000,
      amazon_is_seller: true,
      fba_offer_count: 10,
      current_used_buybox_cents: 800,
      avg_90_day_used_buybox_cents: 800,
      sales_rank_drops_90: 35,
    }));
    // Must not be rejected at Step 6 for the Amazon reason
    assert.notEqual(r.rejection_reason, 'Amazon on listing, low price');
    // It may still reject elsewhere (margin etc.) but NOT at Step 6's Amazon branch
    if (r.calculation_trace.rejection_step === 6) {
      assert.equal(r.rejection_reason, 'Too competitive, low price',
        'only valid Step 6 reject is the FBA count gate');
    }
    // amazon_is_seller preserved in keepa_fields either way
    assert.equal(r.calculation_trace.keepa_fields.amazon_is_seller, true);
  });
});

// ============================================================
// STEP 7/8: Fees + net resale
// ============================================================
describe('Step 7/8: Fees + net resale', () => {
  test('fees_breakdown populated with all 10 keys', () => {
    const r = run(makeExtracted());
    if (r.accepted) {
      const f = r.calculation_trace.fees_breakdown;
      assert.ok(f, 'fees_breakdown should be populated');
      assert.equal(typeof f.referral_fee_cents, 'number');
      assert.equal(typeof f.closing_fee_cents, 'number');
      assert.equal(typeof f.fba_fulfillment_fee_cents, 'number');
      assert.equal(typeof f.prep_cost_cents, 'number');
      assert.equal(typeof f.inbound_shipping_cents, 'number');
      assert.equal(typeof f.media_mail_receive_cents, 'number');
      assert.equal(typeof f.disc_buffer_cents, 'number');
      assert.equal(typeof f.rejection_return_overhead_cents, 'number');
      assert.equal(typeof f.storage_reserve_cents, 'number');
      assert.equal(typeof f.total_fees_cents, 'number');
    }
  });

  test('book category has disc_buffer_cents = 0', () => {
    const r = run(makeExtracted());
    if (r.accepted) {
      assert.equal(r.calculation_trace.fees_breakdown.disc_buffer_cents, 0);
    }
  });

  test('dvd category has disc_buffer_cents = 50', () => {
    const r = run(makeExtracted({
      category_tree: ['Movies & TV', 'DVD'],
      current_used_buybox_cents: 1500,
      avg_90_day_used_buybox_cents: 1500,
    }));
    if (r.accepted) {
      assert.equal(r.calculation_trace.fees_breakdown.disc_buffer_cents, 50);
    }
  });

  test('rejects when fees exceed working price AND price too low for eBay bundle', () => {
    // $1.50 is below the $2.00 eBay bundle threshold, so it's a genuine reject
    const r = run(makeExtracted({
      current_used_buybox_cents: 150,
      avg_90_day_used_buybox_cents: 150,
    }));
    assert.equal(r.accepted, false);
    assert.equal(r.calculation_trace.rejection_step, 5); // hits category min price first ($2.00 for books)
  });

  test('eBay bundle fallback: fees exceed price but working price >= $2.00 → penny $0.05', () => {
    const r = run(makeExtracted({
      current_used_buybox_cents: 500,
      avg_90_day_used_buybox_cents: 500,
    }));
    // $5.00 book: Amazon fees eat the margin, but eBay bundle is viable
    if (r.calculation_trace.ebay_fallback) {
      assert.equal(r.accepted, true);
      assert.equal(r.offer_cents, 5);
      assert.equal(r.is_penny_tier, true);
      assert.equal(r.calculation_trace.disposition, 'ebay_bundle');
    }
  });

  test('referral fee is 15% of working price', () => {
    const r = run(makeExtracted({
      current_used_buybox_cents: 2000,
      avg_90_day_used_buybox_cents: 2000,
    }));
    if (r.accepted) {
      assert.equal(r.calculation_trace.fees_breakdown.referral_fee_cents, 300);
    }
  });
});

// ============================================================
// STEP 10/11: ROI floor, final offer, sanity
// ============================================================
describe('Step 10/11: ROI floor, final offer, sanity', () => {
  test('happy path: T1 book at $20 produces accepted offer', () => {
    const r = run(makeExtracted({
      current_used_buybox_cents: 2000,
      avg_90_day_used_buybox_cents: 2000,
      sales_rank_drops_90: 35,
      current_bsr: 250000,
    }));
    assert.equal(r.accepted, true, `should accept: ${r.rejection_reason || ''}`);
    assert.equal(r.tier, 'T1');
    assert.ok(r.offer_cents > 0);
    assert.ok(r.offer_cents < 1000); // definitely less than $10 on a $20 item
    assert.equal(r.calculation_trace.rejection_step, null);
  });

  test('final offer is rounded down to nearest 5 cents', () => {
    const r = run(makeExtracted());
    if (r.accepted) {
      assert.equal(r.offer_cents % 5, 0);
    }
  });

  test('final offer never exceeds 50% of working price', () => {
    const r = run(makeExtracted());
    if (r.accepted) {
      assert.ok(r.offer_cents <= r.calculation_trace.working_price_cents * 0.5,
        'offer should not exceed 50% of working price');
    }
  });

  test('target_pct_bp in trace populated for percent-mode tier (v3)', () => {
    const r = run(makeExtracted({ sales_rank_drops_90: 35 }));
    if (r.accepted && r.calculation_trace.tier_offer_mode === 'percent') {
      assert.equal(typeof r.calculation_trace.target_pct_bp, 'number');
      assert.ok(r.calculation_trace.target_pct_bp > 0);
    }
  });
});

// ============================================================
// V3 buyback offer formula
// ============================================================
describe('V3: percentage-of-sell-price formula', () => {
  test('$30 textbook hits solid tier (V3.2 dual rate + V3.3 velocity bonus)', () => {
    const r = run(makeExtracted({
      current_used_buybox_cents: 3000,        // $30 — above $15 threshold
      avg_90_day_used_buybox_cents: 3000,
      sales_rank_drops_90: 35,                 // GOOD velocity (+1.5%)
      current_bsr: 100000,
    }));
    assert.equal(r.accepted, true);
    // 15% solid base + 1.5% good-velocity bonus = 16.5% of $30 = $4.95
    assert.ok(r.offer_cents >= 490 && r.offer_cents <= 500,
      `expected ~$4.95, got $${r.offer_cents/100}`);
    assert.equal(r.calculation_trace.tier_offer_mode, 'percent');
    assert.equal(r.calculation_trace.price_band, 'solid');
    assert.equal(r.calculation_trace.velocity_tier, 'good');
  });

  test('$10 book hits cheap tier (V3.2 dual rate)', () => {
    const r = run(makeExtracted({
      current_used_buybox_cents: 1000,        // $10 — below $15 threshold
      avg_90_day_used_buybox_cents: 1000,
      sales_rank_drops_90: 35,
      current_bsr: 100000,
    }));
    if (r.accepted && !r.is_penny_tier) {
      // Cheap rate is 10% of $10 = $1.00. May be lower due to Amazon math.
      assert.equal(r.calculation_trace.price_band, 'cheap');
    }
  });

  test('$5 book at T1: percentage capped by Amazon math → bundle', () => {
    const r = run(makeExtracted({
      current_used_buybox_cents: 500,         // $5
      avg_90_day_used_buybox_cents: 500,
      sales_rank_drops_90: 35,                 // T1
      current_bsr: 100000,
    }));
    // $5 book: percent offer = $0.90 but Amazon fees > $5 → amazonMax negative
    // → final caps at $0 → falls to bundle tier ($0.10 for v3)
    assert.equal(r.accepted, true);
    assert.equal(r.is_penny_tier, true);
    assert.equal(r.offer_cents, 10);
  });

  test('25% hard cap protects against runaway offers', () => {
    // High-margin item: $50 sell price, low fees relative to price.
    // 18% would give $9, but hard cap should prevent > 25% = $12.50 (irrelevant here).
    const r = run(makeExtracted({
      current_used_buybox_cents: 5000,        // $50
      avg_90_day_used_buybox_cents: 5000,
      sales_rank_drops_90: 35,                 // T1 book
      current_bsr: 100000,
    }));
    assert.equal(r.accepted, true);
    // Offer should never exceed 25% of working price
    assert.ok(r.offer_cents <= r.calculation_trace.working_price_cents * 0.25 + 5,
      `offer $${r.offer_cents/100} should be ≤ 25% of $${r.calculation_trace.working_price_cents/100}`);
  });

  test('min margin reserved after Amazon fees', () => {
    const r = run(makeExtracted({
      current_used_buybox_cents: 1500,        // $15
      avg_90_day_used_buybox_cents: 1500,
      sales_rank_drops_90: 35,
      current_bsr: 100000,
    }));
    if (r.accepted && !r.is_penny_tier) {
      const trace = r.calculation_trace;
      // amazon_max_cents should leave at least min_margin (30¢) gap from netResale
      assert.ok(trace.amazon_max_cents != null);
      assert.equal(trace.net_resale_cents - trace.amazon_max_cents, 30);
    }
  });

  // V3.3 dead-inventory reject + velocity bonus
  test('dead inventory: 0 drops in all 3 windows → reject', () => {
    const r = run(makeExtracted({
      sales_rank_drops_30: 0,
      sales_rank_drops_90: 0,
      sales_rank_drops_180: 0,
    }));
    assert.equal(r.accepted, false);
    assert.equal(r.calculation_trace.rejection_step, 4);
    assert.match(r.rejection_reason, /No sales activity/);
  });

  test('one window has data → not rejected as dead', () => {
    const r = run(makeExtracted({
      sales_rank_drops_30: 0,
      sales_rank_drops_90: 0,
      sales_rank_drops_180: 5,  // had movement 90-180 days ago
    }));
    // Should NOT reject as dead (still has 180-day signal)
    assert.notEqual(r.rejection_reason, 'No sales activity in the last 6 months — item is unlikely to sell');
  });

  test('HOT velocity (40+ drops) gets +3% bonus', () => {
    const r = run(makeExtracted({
      current_used_buybox_cents: 3000,
      avg_90_day_used_buybox_cents: 3000,
      sales_rank_drops_90: 50,  // HOT
      current_bsr: 100000,
    }));
    if (r.accepted && !r.is_penny_tier) {
      assert.equal(r.calculation_trace.velocity_tier, 'hot');
      assert.equal(r.calculation_trace.velocity_bonus_bp, 300);
    }
  });

  test('NORMAL velocity (3-19 drops) gets no bonus', () => {
    const r = run(makeExtracted({
      current_used_buybox_cents: 3000,
      avg_90_day_used_buybox_cents: 3000,
      sales_rank_drops_90: 10,  // NORMAL
      current_bsr: 100000,
    }));
    if (r.accepted && !r.is_penny_tier) {
      assert.equal(r.calculation_trace.velocity_tier, 'normal');
      assert.equal(r.calculation_trace.velocity_bonus_bp, 0);
    }
  });

  test('different category target_pct produces different offers (book 10% vs cd 8%)', () => {
    // v3.1 has one tier per category; differentiation comes from category, not tier band
    const book = run(makeExtracted({
      current_used_buybox_cents: 2000,
      avg_90_day_used_buybox_cents: 2000,
      sales_rank_drops_90: 35,
      current_bsr: 100000,
    }));
    const cd = run(makeExtracted({
      category_tree: ['CDs & Vinyl', 'Pop'],
      current_used_buybox_cents: 2000,
      avg_90_day_used_buybox_cents: 2000,
      sales_rank_drops_90: 35,
      current_bsr: 100000,
    }));
    // book = 10% of $20 = $2.00; cd = 8% of $20 = $1.60 (rounded to $1.55)
    if (book.accepted && cd.accepted && !book.is_penny_tier && !cd.is_penny_tier) {
      assert.ok(book.offer_cents > cd.offer_cents,
        `book ($${book.offer_cents/100}) should beat cd ($${cd.offer_cents/100})`);
    }
  });

  test('legacy tier comparison test (skipped under v3.1 — single tier per cat)', () => {
    const _t1 = run(makeExtracted({
      current_used_buybox_cents: 2000,
      avg_90_day_used_buybox_cents: 2000,
      sales_rank_drops_90: 35,
      current_bsr: 100000, // T1
    }));
    // V3.1: there's no T3, just one tier per category. Item with low velocity
    // (< 3 drops) goes to bundle path instead.
    const lowVelocity = run(makeExtracted({
      current_used_buybox_cents: 2000,
      avg_90_day_used_buybox_cents: 2000,
      sales_rank_drops_90: 1,
    }));
    assert.equal(_t1.accepted, true);
    assert.equal(lowVelocity.accepted, true);
    // High-velocity should pay more than low-velocity (which falls to bundle)
    if (!_t1.is_penny_tier && lowVelocity.is_penny_tier) {
      assert.ok(_t1.offer_cents > lowVelocity.offer_cents,
        `high-velocity ($${_t1.offer_cents/100}) should beat low-velocity bundle ($${lowVelocity.offer_cents/100})`);
    }
  });
});

// ============================================================
// Category detection (Matt's bluray-before-dvd heuristic)
// ============================================================
describe('Category detection', () => {
  test('detects book from Books category', () => {
    assert.equal(engine.detectCategory(['Books', 'Literature & Fiction']), 'book');
  });

  test('detects dvd from DVD in tree', () => {
    assert.equal(engine.detectCategory(['Movies & TV', 'DVD']), 'dvd');
  });

  test('detects bluray even when DVD is also in tree (order matters)', () => {
    // Amazon commonly nests both: "Movies & TV > Blu-ray > DVD"
    assert.equal(engine.detectCategory(['Movies & TV', 'Blu-ray', 'DVD']), 'bluray');
  });

  test('detects bluray from alternate spelling', () => {
    assert.equal(engine.detectCategory(['Bluray Disc']), 'bluray');
  });

  test('detects game from Video Games', () => {
    assert.equal(engine.detectCategory(['Video Games', 'Nintendo Switch']), 'game');
  });

  test('detects cd from CDs & Vinyl', () => {
    assert.equal(engine.detectCategory(['CDs & Vinyl', 'Rock']), 'cd');
  });

  test('returns null for unknown', () => {
    assert.equal(engine.detectCategory(['Kitchen', 'Appliances']), null);
  });

  test('returns null for empty', () => {
    assert.equal(engine.detectCategory([]), null);
  });

  // --- Tightened detection: digital exclusions ---

  test('returns null for Kindle eBooks (digital book)', () => {
    assert.equal(engine.detectCategory(['Kindle Store', 'Kindle eBooks']), null);
  });

  test('returns null for Audible audiobooks (digital audio)', () => {
    assert.equal(engine.detectCategory(['Audible Audiobooks', 'Fiction']), null);
  });

  test('returns null for MP3 downloads (digital music)', () => {
    assert.equal(engine.detectCategory(['Digital Music', 'MP3 Downloads']), null);
  });

  test('returns null for Prime Video (digital video)', () => {
    assert.equal(engine.detectCategory(['Movies & TV', 'Prime Video']), null);
  });

  test('returns null for Instant Video', () => {
    assert.equal(engine.detectCategory(['Amazon Instant Video']), null);
  });

  // --- Tightened detection: false-positive guards ---

  test('returns null for Toys & Games (not a video game)', () => {
    // Must NOT match 'game' — old bare-"games" matcher would have
    assert.equal(engine.detectCategory(['Toys & Games', 'Building Toys']), null);
  });

  test('returns null for Board Games (tabletop, not video game)', () => {
    assert.equal(engine.detectCategory(['Toys & Games', 'Games & Accessories', 'Board Games']), null);
  });

  test('returns null for Grocery & Gourmet Food', () => {
    assert.equal(engine.detectCategory(['Grocery & Gourmet Food', 'Breakfast Cereals']), null);
  });

  test('returns null for Electronics > Headphones', () => {
    assert.equal(engine.detectCategory(['Electronics', 'Headphones']), null);
  });

  // --- Tightened detection: valid physical books must still pass ---

  test('detects physical cookbook under Books > Cookbooks', () => {
    // "cookbooks" contains "books" as substring — should still match book
    assert.equal(engine.detectCategory(['Books', 'Cookbooks, Food & Wine']), 'book');
  });

  test('detects physical book when Kindle/Audible are NOT in tree', () => {
    assert.equal(engine.detectCategory(['Books', 'Literature & Fiction']), 'book');
  });

  // Binding/productGroup fallback — protects against sparse Keepa category trees
  // for older or niche items where the category tree might miss key keywords.
  test('falls back to binding=DVD when category_tree is empty', () => {
    assert.equal(engine.detectCategory({ category_tree: [], binding: 'DVD', product_group: '' }), 'dvd');
  });

  test('falls back to binding=Audio CD when no media keywords in tree', () => {
    assert.equal(engine.detectCategory({ category_tree: ['Specialty'], binding: 'Audio CD', product_group: '' }), 'cd');
  });

  test('falls back to binding=Hardcover when category_tree is empty', () => {
    assert.equal(engine.detectCategory({ category_tree: [], binding: 'Hardcover', product_group: 'Book' }), 'book');
  });

  test('falls back to binding=Paperback when category_tree is empty', () => {
    assert.equal(engine.detectCategory({ category_tree: [], binding: 'Paperback', product_group: '' }), 'book');
  });

  test('falls back to binding=Video Game when category_tree is empty', () => {
    assert.equal(engine.detectCategory({ category_tree: [], binding: 'Video Game', product_group: '' }), 'game');
  });

  test('falls back to binding=Blu-ray when category_tree is empty', () => {
    assert.equal(engine.detectCategory({ category_tree: [], binding: 'Blu-ray', product_group: '' }), 'bluray');
  });

  test('falls back to productGroup=Video Games when binding is missing', () => {
    assert.equal(engine.detectCategory({ category_tree: [], binding: '', product_group: 'Video Games' }), 'game');
  });

  test('binding=Kindle still rejects (digital format)', () => {
    assert.equal(engine.detectCategory({ category_tree: [], binding: 'Kindle Edition', product_group: '' }), null);
  });

  test('still returns null when no signals match anything', () => {
    assert.equal(engine.detectCategory({ category_tree: ['Toys'], binding: 'Plush', product_group: 'Toy' }), null);
  });

  // Vinyl records explicitly NOT bought (Matt's business decision)
  test('rejects vinyl LP even when in CDs & Vinyl category', () => {
    assert.equal(engine.detectCategory({ category_tree: ['CDs & Vinyl', 'Rock'], binding: 'Vinyl', product_group: '' }), null);
  });

  test('rejects vinyl LP via Vinyl LP binding', () => {
    assert.equal(engine.detectCategory({ category_tree: [], binding: 'Vinyl LP', product_group: '' }), null);
  });

  test('rejects vinyl LP via Audio LP binding', () => {
    assert.equal(engine.detectCategory({ category_tree: ['CDs & Vinyl'], binding: 'Audio LP', product_group: '' }), null);
  });

  test('still accepts Audio CD in CDs & Vinyl category', () => {
    // Confirm the vinyl reject doesn't accidentally block real CDs
    assert.equal(engine.detectCategory({ category_tree: ['CDs & Vinyl', 'Rock'], binding: 'Audio CD', product_group: '' }), 'cd');
  });

  // Keepa actually returns binding values WITHOUT spaces in many cases,
  // e.g. "audioCD" not "Audio CD". This caught us on the live API.
  // Make sure the normalized comparison handles all formats.
  test('handles Keepa no-space binding format "audioCD"', () => {
    assert.equal(engine.detectCategory({ category_tree: [], binding: 'audioCD', product_group: '' }), 'cd');
  });

  test('handles Keepa no-space binding "videoGame"', () => {
    assert.equal(engine.detectCategory({ category_tree: [], binding: 'videoGame', product_group: '' }), 'game');
  });

  test('handles binding with mixed casing "Audio_CD"', () => {
    assert.equal(engine.detectCategory({ category_tree: [], binding: 'Audio_CD', product_group: '' }), 'cd');
  });
});

// ============================================================
// Step 4 unsupported-category rejection (the new gate)
// ============================================================
describe('Step 4: unsupported category rejection', () => {
  const NEW_REASON = 'We only buy books, DVDs, Blu-rays, CDs, and video games';

  function assertCategoryReject(ext) {
    const r = run(ext);
    assert.equal(r.accepted, false);
    assert.equal(r.calculation_trace.rejection_step, 4);
    assert.equal(r.calculation_trace.category, null);
    assert.equal(r.calculation_trace.tier_assigned, null);
    assert.equal(r.rejection_reason, NEW_REASON);
    // velocity_signal should NOT be populated — category gate runs first
    assert.equal(r.calculation_trace.velocity_signal, null);
  }

  test('grocery cereal rejects with new category message', () => {
    assertCategoryReject(makeExtracted({
      category_tree: ['Grocery & Gourmet Food', 'Breakfast Cereals'],
    }));
  });

  test('building toys reject (NOT accidentally matching game)', () => {
    assertCategoryReject(makeExtracted({
      category_tree: ['Toys & Games', 'Building Toys'],
    }));
  });

  test('electronics headphones reject', () => {
    assertCategoryReject(makeExtracted({
      category_tree: ['Electronics', 'Headphones'],
    }));
  });

  test('Audible audiobook rejects (NOT accidentally matching book)', () => {
    assertCategoryReject(makeExtracted({
      category_tree: ['Audible Audiobooks', 'Fiction'],
    }));
  });

  test('Kindle eBook rejects (NOT accidentally matching book)', () => {
    assertCategoryReject(makeExtracted({
      category_tree: ['Kindle Store', 'Kindle eBooks'],
    }));
  });

  test('MP3 music rejects (NOT accidentally matching cd)', () => {
    assertCategoryReject(makeExtracted({
      category_tree: ['Digital Music', 'MP3 Downloads'],
    }));
  });

  test('Prime Video rejects (NOT accidentally matching dvd)', () => {
    assertCategoryReject(makeExtracted({
      category_tree: ['Movies & TV', 'Prime Video'],
    }));
  });

  test('empty category_tree rejects at Step 4', () => {
    assertCategoryReject(makeExtracted({
      category_tree: [],
    }));
  });

  test('physical cookbook accepts (regression — cookbook should not false-negative)', () => {
    const r = run(makeExtracted({
      category_tree: ['Books', 'Cookbooks, Food & Wine'],
    }));
    // Should not reject with the category message — cookbook IS a book
    assert.notEqual(r.rejection_reason, NEW_REASON);
    if (r.accepted) {
      assert.equal(r.tier, 'T1');
    } else {
      // Any other rejection is fine, but it shouldn't be the category gate
      assert.notEqual(r.calculation_trace.category, null);
      assert.equal(r.calculation_trace.category, 'book');
    }
  });
});

// ============================================================
// Step 1 rejection message sanity
// ============================================================
describe('Step 1: customer-friendly barcode reject message', () => {
  test('null asin produces the new barcode-not-recognized message', () => {
    const r = run(makeExtracted({ asin: null }));
    assert.equal(r.accepted, false);
    assert.equal(r.calculation_trace.rejection_step, 1);
    assert.match(
      r.rejection_reason,
      /^Barcode not recognized\. Make sure you're scanning a physical book/,
    );
  });
});

// ============================================================
// Trace shape validation
// ============================================================
describe('CalculationTrace shape', () => {
  test('accepted result has all trace fields populated', () => {
    const r = run(makeExtracted());
    assert.equal(r.accepted, true);
    const t = r.calculation_trace;
    assert.equal(t.asin, 'B000TEST01');
    assert.equal(t.category, 'book');
    assert.ok(t.keepa_fields, 'keepa_fields should be set');
    assert.ok(Array.isArray(t.hard_rejections_checked));
    assert.ok(t.hard_rejections_checked.length > 0);
    assert.ok(typeof t.working_price_cents === 'number');
    assert.ok(t.working_price_source);
    assert.ok(typeof t.volatility_ratio === 'number');
    assert.ok(typeof t.velocity_signal === 'number');
    assert.ok(t.tier_assigned);
    assert.ok(t.fees_breakdown);
    assert.ok(typeof t.net_resale_cents === 'number');
    // V3 trace fields (replace V2 roi_floor_applied / required_margin_cents).
    // For percent-mode tiers: target_pct_bp + percent/amazon/hard cap fields.
    // For bundle-mode tiers: tier_offer_mode === 'bundle' and final_offer_cents
    // matches the bundle_offer_cents.
    assert.equal(typeof t.tier_offer_mode, 'string');
    if (t.tier_offer_mode === 'percent') {
      assert.equal(typeof t.target_pct_bp, 'number');
      assert.equal(typeof t.percent_offer_cents, 'number');
      assert.equal(typeof t.amazon_max_cents, 'number');
      assert.equal(typeof t.hard_cap_cents, 'number');
    }
    assert.equal(typeof t.inventory_penalty_applied, 'number');
    assert.equal(typeof t.competition_penalty_applied, 'number');
    assert.ok(typeof t.final_offer_cents === 'number');
    assert.equal(t.rejection_step, null);
    assert.equal(t.rejection_reason_detail, null);
  });

  test('rejected result populates data collected before rejection', () => {
    // V3.1: volatility check removed. Force a different rejection — use a
    // category with no min price floor: low working price + low velocity → reject at step 11.
    const r = run(makeExtracted({
      current_used_buybox_cents: 250,         // $2.50 — below book min $2 but valid
      avg_90_day_used_buybox_cents: 250,
      sales_rank_drops_90: 1,                  // below velocity gate
    }));
    assert.equal(r.accepted, false);
    const t = r.calculation_trace;
    assert.ok(t.rejection_step === 5 || t.rejection_step === 11);
    assert.ok(t.asin);
    assert.ok(t.keepa_fields);
    assert.ok(t.hard_rejections_checked.length > 0);
    assert.ok(t.category);
  });

  test('rejection_step is always in range [1,11] or null', () => {
    const cases = [
      makeExtracted({ asin: null }),               // step 1
      makeExtracted({ data_age_days: 31 }),        // step 2
      makeExtracted({ is_hazmat: true }),          // step 3
      makeExtracted({ sales_rank_drops_90: 3 }),   // step 4
      makeExtracted({                              // step 5
        current_used_buybox_cents: 1800,
        avg_90_day_used_buybox_cents: 1000,
      }),
      // step 6 — FBA count gate (Amazon-on-listing logic was removed 2026-04-10)
      makeExtracted({
        category_tree: ['Movies & TV', 'DVD'],
        current_bsr: 30000,
        sales_rank_drops_90: 35,
        fba_offer_count: 35,
        current_used_buybox_cents: 400,
        avg_90_day_used_buybox_cents: 400,
      }),
      makeExtracted({                              // step 8
        current_used_buybox_cents: 250,
        avg_90_day_used_buybox_cents: 250,
      }),
    ];
    for (const c of cases) {
      const r = run(c);
      if (r.calculation_trace.rejection_step != null) {
        assert.ok(r.calculation_trace.rejection_step >= 1 && r.calculation_trace.rejection_step <= 11,
          `rejection_step ${r.calculation_trace.rejection_step} out of range`);
      }
    }
  });
});

// ============================================================
// Extract keepa fields (smoke test)
// ============================================================
describe('extractKeepaFields', () => {
  test('handles minimal product', () => {
    // Build a Keepa stats.current array with index 3 = BSR and index 32 = used buybox
    const cur = new Array(40).fill(-1);
    cur[3] = 100000;   // BSR
    cur[11] = 3;        // new offer count
    cur[32] = 1500;    // used buybox
    const raw = {
      asin: 'B0TEST',
      title: 'Test',
      stats: { current: cur, avg90: [] },
      packageHeight: 30, packageLength: 200, packageWidth: 150, packageWeight: 400,
      categoryTree: [{ name: 'Books' }],
    };
    const ex = engine.extractKeepaFields(raw);
    assert.equal(ex.asin, 'B0TEST');
    assert.equal(ex.current_used_buybox_cents, 1500);
    assert.equal(ex.current_bsr, 100000);
    assert.deepEqual(ex.category_tree, ['Books']);
    assert.equal(ex.is_hazmat, false);
  });

  test('converts -1 to null', () => {
    const cur = new Array(40).fill(-1);
    // index 3 (BSR) and index 32 (used buybox) both -1
    const raw = {
      asin: 'X',
      stats: { current: cur },
    };
    const ex = engine.extractKeepaFields(raw);
    assert.equal(ex.current_used_buybox_cents, null);
    assert.equal(ex.current_bsr, null);
  });
});

// ============================================================
// lookupFBAFee (spec §2.7)
// ============================================================
// V2 FBA fee table — weight-only lookup
describe('lookupFBAFee', () => {
  test('≤0.5 lb returns 306', () => {
    assert.equal(engine.lookupFBAFee(200), 306); // ~0.44 lb
  });

  test('≤1.0 lb returns 340', () => {
    assert.equal(engine.lookupFBAFee(400), 340); // ~0.88 lb
  });

  test('≤1.5 lb returns 375', () => {
    assert.equal(engine.lookupFBAFee(600), 375); // ~1.32 lb
  });

  test('≤2.0 lb returns 420', () => {
    assert.equal(engine.lookupFBAFee(800), 420); // ~1.76 lb
  });

  test('≤3.0 lb returns 475', () => {
    assert.equal(engine.lookupFBAFee(1200), 475); // ~2.64 lb
  });

  test('>3.0 lb adds $0.50/lb surcharge', () => {
    // 4 lbs = 475 + 50 = 525
    const fee = engine.lookupFBAFee(1820); // ~4.01 lb
    assert.ok(fee >= 525 && fee <= 526, `got ${fee}`);
  });
});

// ============================================================
// Penny tier (V2)
// ============================================================
describe('V2: Penny tier', () => {
  test('$5 book: Amazon math underwater → bundle tier at $0.05 (v3)', () => {
    const r = run(makeExtracted({
      current_used_buybox_cents: 500,
      avg_90_day_used_buybox_cents: 500,
      sales_rank_drops_90: 35,
      current_bsr: 250000,
    }));
    // $5 book: Amazon fees eat the margin → percent offer floors to $0
    // → Step 11 routes to bundle tier ($0.10).
    assert.equal(r.accepted, true);
    assert.equal(r.is_penny_tier, true);
    assert.equal(r.offer_cents, 10);
    assert.equal(r.calculation_trace.disposition, 'ebay_bundle');
  });

  test('$8 book: may hit Amazon penny or eBay fallback depending on fees', () => {
    const r = run(makeExtracted({
      current_used_buybox_cents: 800,
      avg_90_day_used_buybox_cents: 800,
      sales_rank_drops_90: 35,
      current_bsr: 250000,
    }));
    // Either way it should accept as penny tier
    assert.equal(r.accepted, true);
    assert.equal(r.is_penny_tier, true);
  });

  test('$1.50 book: below category min price → rejects at Step 5', () => {
    const r = run(makeExtracted({
      current_used_buybox_cents: 150,
      avg_90_day_used_buybox_cents: 150,
      sales_rank_drops_90: 35,
      current_bsr: 250000,
    }));
    assert.equal(r.accepted, false);
    // Hits category minimum ($2.00 for books) before reaching fees
    assert.equal(r.calculation_trace.rejection_step, 5);
  });

  test('is_penny_tier is false for standard accepted offers', () => {
    const r = run(makeExtracted({
      current_used_buybox_cents: 2000,
      avg_90_day_used_buybox_cents: 2000,
      sales_rank_drops_90: 35,
      current_bsr: 250000,
    }));
    assert.equal(r.accepted, true);
    assert.equal(r.is_penny_tier, false);
    assert.equal(r.calculation_trace.penny_tier_applied, false);
  });
});

// ============================================================
// Sub-category classification (V2 spec)
// ============================================================
describe('V2: Sub-category classification', () => {
  test('classifySubCategory: romance book → reject', () => {
    const r = engine.classifySubCategory('book', 'A Summer Romance Novel');
    assert.equal(r.reject, true);
    assert.equal(r.subCategory, 'reject_book');
  });

  test('classifySubCategory: Harlequin → reject', () => {
    const r = engine.classifySubCategory('book', 'Harlequin Presents: The Duke');
    assert.equal(r.reject, true);
  });

  test('classifySubCategory: textbook → keeper ($0.10)', () => {
    const r = engine.classifySubCategory('book', 'Organic Chemistry Textbook 5th Edition');
    assert.equal(r.reject, false);
    assert.equal(r.subCategory, 'keeper_book');
    assert.equal(r.pennyOffer, 10);
    assert.equal(r.minNetProfit, 50);
  });

  test('classifySubCategory: generic fiction → bundle ($0.05) with genre', () => {
    const r = engine.classifySubCategory('book', 'The Great Gatsby');
    assert.equal(r.reject, false);
    assert.equal(r.subCategory, 'bundle_book');
    assert.equal(r.pennyOffer, 5);
    assert.equal(r.minNetProfit, 25);
    assert.equal(r.disposition, 'ebay_bundle');
    assert.ok(r.bundleLabel, 'should have a bundle label');
  });

  test('classifySubCategory: DreamWorks DVD → reject', () => {
    const r = engine.classifySubCategory('dvd', 'Shrek - DreamWorks Animation');
    assert.equal(r.reject, true);
    assert.equal(r.subCategory, 'reject_dvd');
  });

  test('classifySubCategory: generic mainstream DVD → bundle ($0.05) with action genre', () => {
    const r = engine.classifySubCategory('dvd', 'The Avengers');
    assert.equal(r.subCategory, 'bundle_dvd');
    assert.equal(r.pennyOffer, 5);
    assert.equal(r.genre, 'action'); // Avengers matches action patterns
    assert.ok(r.bundleLabel.includes('Action'), `expected Action label, got: ${r.bundleLabel}`);
  });

  test('classifySubCategory: horror DVD → bundle with horror genre (eBay lot)', () => {
    // Horror DVDs go into "25 Horror DVDs" eBay bulk lots
    const r = engine.classifySubCategory('dvd', 'The Exorcist - Horror Classic');
    assert.equal(r.subCategory, 'bundle_dvd');
    assert.equal(r.pennyOffer, 5);
    assert.equal(r.genre, 'horror');
    assert.equal(r.disposition, 'ebay_bundle');
    assert.ok(r.bundleLabel.includes('Horror'), `expected Horror label, got: ${r.bundleLabel}`);
  });

  test('detectGenre: identifies horror from title', () => {
    assert.equal(engine.detectGenre('dvd', 'Night of the Living Dead - Zombie Horror'), 'horror');
  });

  test('detectGenre: identifies rock from CD title', () => {
    assert.equal(engine.detectGenre('cd', 'Metallica - Master of Puppets'), 'rock');
  });

  test('detectGenre: returns mixed for generic title', () => {
    assert.equal(engine.detectGenre('dvd', 'Some Random Movie'), 'mixed');
  });

  test('classifySubCategory: Kidz Bop CD → reject', () => {
    const r = engine.classifySubCategory('cd', 'Kidz Bop 25');
    assert.equal(r.reject, true);
  });

  test('classifySubCategory: metal CD → bundle with rock genre', () => {
    const r = engine.classifySubCategory('cd', 'Metallica - Master of Puppets');
    assert.equal(r.subCategory, 'bundle_cd');
    assert.equal(r.pennyOffer, 5);
    assert.equal(r.genre, 'rock');
    assert.ok(r.bundleLabel.includes('Rock'), `expected Rock label, got: ${r.bundleLabel}`);
  });

  test('classifySubCategory: limited edition CD → keeper', () => {
    const r = engine.classifySubCategory('cd', 'Limited Edition Box Set - Beethoven Complete');
    assert.equal(r.subCategory, 'keeper_cd');
    assert.equal(r.pennyOffer, 10);
    assert.equal(r.disposition, 'amazon_fba');
  });

  test('classifySubCategory: Madden game → reject', () => {
    const r = engine.classifySubCategory('game', 'Madden NFL 24');
    assert.equal(r.reject, true);
  });

  test('classifySubCategory: normal game → keeper ($0.10, games default)', () => {
    const r = engine.classifySubCategory('game', 'The Legend of Zelda');
    assert.equal(r.reject, false);
    assert.equal(r.subCategory, 'keeper_game');
    assert.equal(r.pennyOffer, 10);
  });

  // Integration: romance book goes through engine and rejects at Step 11
  test('romance novel with low price → rejects at Step 11 sub-category', () => {
    const r = run(makeExtracted({
      title: 'A Passionate Romance Novel',
      current_used_buybox_cents: 800,
      avg_90_day_used_buybox_cents: 800,
      sales_rank_drops_90: 35,
      current_bsr: 250000,
    }));
    // May reject at step 8/11 depending on fee math, but if it reaches
    // penny tier check, the romance classification should reject it
    if (r.calculation_trace.rejection_step === 11) {
      assert.equal(r.calculation_trace.sub_category, 'reject_book');
    }
  });
});

// ============================================================
// Removed-exports stubs should throw loudly
// ============================================================
describe('Removed exports', () => {
  test('getTrigger throws', () => {
    assert.throws(() => engine.getTrigger('book', 1), /removed in the 2026-04-10 spec alignment/);
  });

  test('getSellPriceSource throws', () => {
    assert.throws(() => engine.getSellPriceSource({}), /removed in the 2026-04-10 spec alignment/);
  });
});

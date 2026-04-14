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
const SEED_TIERS = [
  // book
  { category: 'book',   tier: 'T1', min_rank_drops_90: 30, bsr_ceiling:  500000, roi_floor_percent:  50, min_flat_margin_cents: 150 },
  { category: 'book',   tier: 'T2', min_rank_drops_90: 15, bsr_ceiling: 1500000, roi_floor_percent:  75, min_flat_margin_cents: 250 },
  { category: 'book',   tier: 'T3', min_rank_drops_90:  8, bsr_ceiling: 2500000, roi_floor_percent: 100, min_flat_margin_cents: 400 },
  { category: 'book',   tier: 'T4', min_rank_drops_90:  4, bsr_ceiling: 3000000, roi_floor_percent: 150, min_flat_margin_cents: 600 },
  // dvd
  { category: 'dvd',    tier: 'T1', min_rank_drops_90: 30, bsr_ceiling:   50000, roi_floor_percent:  50, min_flat_margin_cents: 150 },
  { category: 'dvd',    tier: 'T2', min_rank_drops_90: 15, bsr_ceiling:   80000, roi_floor_percent:  75, min_flat_margin_cents: 250 },
  { category: 'dvd',    tier: 'T3', min_rank_drops_90:  8, bsr_ceiling:  120000, roi_floor_percent: 100, min_flat_margin_cents: 400 },
  { category: 'dvd',    tier: 'T4', min_rank_drops_90:  4, bsr_ceiling:  150000, roi_floor_percent: 150, min_flat_margin_cents: 600 },
  // bluray
  { category: 'bluray', tier: 'T1', min_rank_drops_90: 30, bsr_ceiling:   50000, roi_floor_percent:  50, min_flat_margin_cents: 150 },
  { category: 'bluray', tier: 'T2', min_rank_drops_90: 15, bsr_ceiling:   80000, roi_floor_percent:  75, min_flat_margin_cents: 250 },
  { category: 'bluray', tier: 'T3', min_rank_drops_90:  8, bsr_ceiling:  120000, roi_floor_percent: 100, min_flat_margin_cents: 400 },
  { category: 'bluray', tier: 'T4', min_rank_drops_90:  4, bsr_ceiling:  150000, roi_floor_percent: 150, min_flat_margin_cents: 600 },
  // cd (no T4)
  { category: 'cd',     tier: 'T1', min_rank_drops_90: 30, bsr_ceiling:  100000, roi_floor_percent:  75, min_flat_margin_cents: 300 },
  { category: 'cd',     tier: 'T2', min_rank_drops_90: 15, bsr_ceiling:  150000, roi_floor_percent: 100, min_flat_margin_cents: 400 },
  { category: 'cd',     tier: 'T3', min_rank_drops_90:  8, bsr_ceiling:  200000, roi_floor_percent: 150, min_flat_margin_cents: 600 },
  // game (no T4)
  { category: 'game',   tier: 'T1', min_rank_drops_90: 30, bsr_ceiling:   50000, roi_floor_percent:  50, min_flat_margin_cents: 250 },
  { category: 'game',   tier: 'T2', min_rank_drops_90: 15, bsr_ceiling:   80000, roi_floor_percent:  75, min_flat_margin_cents: 400 },
  { category: 'game',   tier: 'T3', min_rank_drops_90:  8, bsr_ceiling:  120000, roi_floor_percent: 100, min_flat_margin_cents: 600 },
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
  min_cart_items: 10,
  quote_expiration_days: 7,
  max_copies_per_asin: 10,
  daily_payout_cap_cents: 200000,
  referral_fee_rate: 0.15,
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
// STEP 4: Velocity + tier assignment
// ============================================================
describe('Step 4: Velocity + tier assignment', () => {
  test('rejects 3 drops (below 4 floor)', () => {
    const r = run(makeExtracted({ sales_rank_drops_90: 3 }));
    assert.equal(r.accepted, false);
    assert.equal(r.rejection_reason, 'Low velocity — sold fewer than 4 times in 90 days');
    assert.equal(r.calculation_trace.rejection_step, 4);
  });

  test('accepts exactly 4 drops (boundary)', () => {
    const r = run(makeExtracted({ sales_rank_drops_90: 4 }));
    assert.notEqual(r.calculation_trace.rejection_step, 4);
  });

  test('assigns T1 at exactly 30 drops', () => {
    const r = run(makeExtracted({ sales_rank_drops_90: 30 }));
    if (r.accepted) assert.equal(r.tier, 'T1');
    assert.equal(r.calculation_trace.tier_assigned, 'T1');
  });

  test('assigns T2 at exactly 15 drops', () => {
    const r = run(makeExtracted({ sales_rank_drops_90: 15 }));
    if (r.accepted) assert.equal(r.tier, 'T2');
    assert.equal(r.calculation_trace.tier_assigned, 'T2');
  });

  test('assigns T3 at exactly 8 drops', () => {
    const r = run(makeExtracted({ sales_rank_drops_90: 8 }));
    if (r.accepted) assert.equal(r.tier, 'T3');
    assert.equal(r.calculation_trace.tier_assigned, 'T3');
  });

  test('assigns T4 at exactly 4 drops', () => {
    const r = run(makeExtracted({ sales_rank_drops_90: 4 }));
    if (r.accepted) assert.equal(r.tier, 'T4');
    assert.equal(r.calculation_trace.tier_assigned, 'T4');
  });

  test('BSR secondary gate — rank drops qualify but BSR exceeds all ceilings -> reject', () => {
    const r = run(makeExtracted({
      sales_rank_drops_90: 35,
      current_bsr: 9_999_999, // exceeds book T4 ceiling of 3,000,000
    }));
    assert.equal(r.accepted, false);
    assert.equal(r.calculation_trace.rejection_step, 4);
    assert.equal(r.rejection_reason, 'Below all tier thresholds');
  });

  test('BSR secondary gate — T1 drops but BSR too deep -> falls to lower tier', () => {
    // book T1 ceiling is 500k. BSR of 1M should push us to T2 (ceiling 1.5M)
    const r = run(makeExtracted({
      sales_rank_drops_90: 35,
      current_bsr: 1_000_000,
    }));
    assert.equal(r.calculation_trace.tier_assigned, 'T2');
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

  test('rejects when avg_90_day is null', () => {
    const r = run(makeExtracted({ avg_90_day_used_buybox_cents: null }));
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

  test('volatility 31% rejects', () => {
    // 1310 vs 1000 -> 31%
    const r = run(makeExtracted({
      current_used_buybox_cents: 1310,
      avg_90_day_used_buybox_cents: 1000,
    }));
    assert.equal(r.rejection_reason, 'Price too volatile');
    assert.equal(r.calculation_trace.rejection_step, 5);
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

  test('rejects when fees exceed working price', () => {
    const r = run(makeExtracted({
      current_used_buybox_cents: 250,
      avg_90_day_used_buybox_cents: 250,
    }));
    // 250 - (37 referral + 180 close + 306 fba + 145 prep + ...) = negative
    assert.equal(r.rejection_reason, 'No margin after fees');
    assert.equal(r.calculation_trace.rejection_step, 8);
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

  test('roi_floor_applied in trace matches tier', () => {
    const r = run(makeExtracted({ sales_rank_drops_90: 35 }));
    if (r.accepted) {
      assert.equal(r.calculation_trace.roi_floor_applied, 50); // T1 book
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
    assert.ok(typeof t.roi_floor_applied === 'number');
    assert.ok(typeof t.required_margin_cents === 'number');
    assert.equal(typeof t.inventory_penalty_applied, 'number');
    assert.equal(typeof t.competition_penalty_applied, 'number');
    assert.ok(typeof t.final_offer_cents === 'number');
    assert.equal(t.rejection_step, null);
    assert.equal(t.rejection_reason_detail, null);
  });

  test('rejected result populates data collected before rejection', () => {
    // Reject at step 5 (volatility). Trace should have asin, keepa_fields,
    // hard_rejections_checked, velocity_signal, tier_assigned, category,
    // but NOT fees_breakdown or final_offer_cents.
    const r = run(makeExtracted({
      current_used_buybox_cents: 2000,
      avg_90_day_used_buybox_cents: 1000, // 100% volatility
    }));
    assert.equal(r.accepted, false);
    const t = r.calculation_trace;
    assert.equal(t.rejection_step, 5);
    assert.ok(t.asin);
    assert.ok(t.keepa_fields);
    assert.ok(t.hard_rejections_checked.length > 0);
    assert.ok(t.velocity_signal);
    assert.ok(t.tier_assigned);
    assert.ok(t.category);
    assert.equal(t.fees_breakdown, null);
    assert.equal(t.final_offer_cents, null);
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
describe('lookupFBAFee', () => {
  test('small standard returns 306', () => {
    // weight 400g, length 350mm, width 200mm, height 15mm
    assert.equal(engine.lookupFBAFee(400, 350, 200, 15), 306);
  });

  test('large standard up to 1 lb returns 325', () => {
    // Not small standard (height > 19mm), weight < 1 lb
    assert.equal(engine.lookupFBAFee(400, 200, 150, 30), 325);
  });

  test('large standard 1-2 lb returns 450', () => {
    assert.equal(engine.lookupFBAFee(700, 200, 150, 30), 450);
  });

  test('large standard 2-3 lb returns 520', () => {
    assert.equal(engine.lookupFBAFee(1100, 200, 150, 30), 520);
  });

  test('large standard 3+ lb adds per-lb surcharge', () => {
    // 4 lbs = 520 + 38 = 558
    const fee = engine.lookupFBAFee(1820, 200, 150, 30);
    assert.ok(fee >= 558 && fee <= 560, `got ${fee}`);
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

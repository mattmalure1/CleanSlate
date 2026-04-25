-- ============================================================
-- 2026-04-25_buyback_tier_v3.sql
-- Buyback Engine v3 — percentage-of-sell-price offers
--
-- Replaces the ROI-floor model (V2) with a buyback-style model
-- where each tier specifies a target percentage of the resale
-- price (basis points). Items that fail Amazon math automatically
-- fall to the bundle tier ($0.05 keeper / eBay genre lot).
--
-- Per-category tier bands derived from Scoutly-style scouting
-- triggers, then translated to buyback offer ranges modeled on
-- Eagle Saver / SellBackYourBook acceptance rates.
-- ============================================================

-- 1. Add new columns to tier_thresholds.
ALTER TABLE tier_thresholds
  ADD COLUMN IF NOT EXISTS bsr_floor BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS target_pct_bp INTEGER,
  ADD COLUMN IF NOT EXISTS offer_mode TEXT DEFAULT 'percent',
  ADD COLUMN IF NOT EXISTS bundle_offer_cents INTEGER DEFAULT 5;

-- 2. Add minimum-margin config key (used by engine to cap offer
--    at netResale - min_margin_cents).
INSERT INTO offer_engine_config (key, value)
VALUES ('min_margin_cents', to_jsonb(30))
ON CONFLICT (key) DO UPDATE SET value = to_jsonb(30);

-- Hard cap: never offer more than this fraction of the working price.
-- Stored as basis points (2500 = 25%).
INSERT INTO offer_engine_config (key, value)
VALUES ('max_offer_pct_bp', to_jsonb(2500))
ON CONFLICT (key) DO UPDATE SET value = to_jsonb(2500);

-- 3. Wipe and reseed tier_thresholds with v3 bands.
DELETE FROM tier_thresholds;

-- ─── Books ───────────────────────────────────────────────────
-- Sell prices range broadly; textbooks at the top push high-tier offers.
INSERT INTO tier_thresholds (
  category, tier, bsr_floor, bsr_ceiling,
  min_rank_drops_90, max_rank_drops_90,
  target_pct_bp, offer_mode, bundle_offer_cents,
  roi_floor_percent, min_flat_margin_cents
) VALUES
  ('book', 'T1',         0,    100000, 50, 9999, 1800, 'percent', 10,  0,  0),
  ('book', 'T2',    100001,    500000, 24, 9999, 1200, 'percent', 10,  0,  0),
  ('book', 'T3',    500001,   1500000, 12, 9999,  700, 'percent', 10,  0,  0),
  ('book', 'T4',   1500001,   3000000,  3, 9999,  400, 'percent', 10,  0,  0),
  ('book', 'T5',   3000001,   8000000,  1, 9999,    0, 'bundle',  10,  0,  0);

-- ─── DVDs ────────────────────────────────────────────────────
INSERT INTO tier_thresholds (
  category, tier, bsr_floor, bsr_ceiling,
  min_rank_drops_90, max_rank_drops_90,
  target_pct_bp, offer_mode, bundle_offer_cents,
  roi_floor_percent, min_flat_margin_cents
) VALUES
  ('dvd',  'T1',        0,     50000, 15, 9999, 1500, 'percent', 10,  0,  0),
  ('dvd',  'T2',    50001,    100000,  5, 9999, 1000, 'percent', 10,  0,  0),
  ('dvd',  'T3',   100001,    200000,  2, 9999,  600, 'percent', 10,  0,  0),
  ('dvd',  'T4',   200001,    500000,  1, 9999,    0, 'bundle',  10,  0,  0);

-- ─── Blu-rays (1-2% higher than DVDs, slightly higher resale) ─
INSERT INTO tier_thresholds (
  category, tier, bsr_floor, bsr_ceiling,
  min_rank_drops_90, max_rank_drops_90,
  target_pct_bp, offer_mode, bundle_offer_cents,
  roi_floor_percent, min_flat_margin_cents
) VALUES
  ('bluray', 'T1',        0,     50000, 15, 9999, 1700, 'percent', 10,  0,  0),
  ('bluray', 'T2',    50001,    100000,  5, 9999, 1100, 'percent', 10,  0,  0),
  ('bluray', 'T3',   100001,    200000,  2, 9999,  700, 'percent', 10,  0,  0),
  ('bluray', 'T4',   200001,    500000,  1, 9999,    0, 'bundle',  10,  0,  0);

-- ─── CDs (lower percentages — saturated market) ──────────────
INSERT INTO tier_thresholds (
  category, tier, bsr_floor, bsr_ceiling,
  min_rank_drops_90, max_rank_drops_90,
  target_pct_bp, offer_mode, bundle_offer_cents,
  roi_floor_percent, min_flat_margin_cents
) VALUES
  ('cd',  'T1',        0,     50000, 15, 9999, 1200, 'percent', 10,  0,  0),
  ('cd',  'T2',    50001,    200000,  5, 9999,  800, 'percent', 10,  0,  0),
  ('cd',  'T3',   200001,    500000,  2, 9999,  500, 'percent', 10,  0,  0),
  ('cd',  'T4',   500001,   1000000,  1, 9999,    0, 'bundle',  10,  0,  0);

-- ─── Video Games (highest percentages — best per-item economics) ─
INSERT INTO tier_thresholds (
  category, tier, bsr_floor, bsr_ceiling,
  min_rank_drops_90, max_rank_drops_90,
  target_pct_bp, offer_mode, bundle_offer_cents,
  roi_floor_percent, min_flat_margin_cents
) VALUES
  ('game', 'T1',        0,     50000, 15, 9999, 2000, 'percent', 10,  0,  0),
  ('game', 'T2',    50001,    100000,  5, 9999, 1200, 'percent', 10,  0,  0),
  ('game', 'T3',   100001,    200000,  2, 9999,  700, 'percent', 10,  0,  0),
  ('game', 'T4',   200001,    500000,  1, 9999,    0, 'bundle',  10,  0,  0);

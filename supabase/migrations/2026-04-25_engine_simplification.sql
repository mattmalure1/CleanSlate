-- ============================================================
-- 2026-04-25_engine_simplification.sql
-- Engine v3.1 — Simplified offer model
--
-- Collapses the 4-5-tier-per-category model into a single tier per
-- category. BSR-band complexity removed. Velocity becomes a binary
-- gate (sold in 90 days or not). Volatility rejection removed.
--
-- Per-category target percentage retained because a $5 paperback
-- and a $30 textbook need different math.
-- ============================================================

-- Wipe existing tiers and seed one row per category.
DELETE FROM tier_thresholds;

-- Velocity gate: items must have at least min_rank_drops_90 sales drops
-- in 90 days to qualify for the percent offer. Below that → bundle (if
-- price >= $3) or reject (if price < $3).
INSERT INTO tier_thresholds (
  category, tier, bsr_floor, bsr_ceiling,
  min_rank_drops_90, max_rank_drops_90,
  target_pct_bp, offer_mode, bundle_offer_cents,
  roi_floor_percent, min_flat_margin_cents
) VALUES
  ('book',   'T1', 0, 999999999, 3, 9999, 1000, 'percent', 10, 0, 0),
  ('dvd',    'T1', 0, 999999999, 3, 9999, 1000, 'percent', 10, 0, 0),
  ('bluray', 'T1', 0, 999999999, 3, 9999, 1200, 'percent', 10, 0, 0),
  ('cd',     'T1', 0, 999999999,  3, 9999,  800, 'percent', 10, 0, 0),
  ('game',   'T1', 0, 999999999, 3, 9999, 1500, 'percent', 10, 0, 0);

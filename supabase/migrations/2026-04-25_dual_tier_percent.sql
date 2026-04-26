-- ============================================================
-- 2026-04-25_dual_tier_percent.sql
-- v3.2 — dual percentage tier (cheap vs solid)
--
-- Adds solid_pct_bp column. Items with working_price < $15 use
-- target_pct_bp (the existing column). Items at $15+ use solid_pct_bp.
-- This lets us bump rates on higher-value items to compete with
-- Eagle Saver / SellBackYourBook on textbooks, premium DVDs, and
-- modern games — without overpaying on cheap common stuff.
-- ============================================================

ALTER TABLE tier_thresholds
  ADD COLUMN IF NOT EXISTS solid_pct_bp INTEGER;

-- Update each category with the new dual rates.
UPDATE tier_thresholds SET target_pct_bp = 1300, solid_pct_bp = 1800 WHERE category = 'book';
UPDATE tier_thresholds SET target_pct_bp = 1300, solid_pct_bp = 1800 WHERE category = 'dvd';
UPDATE tier_thresholds SET target_pct_bp = 1400, solid_pct_bp = 2000 WHERE category = 'bluray';
UPDATE tier_thresholds SET target_pct_bp = 1000, solid_pct_bp = 1300 WHERE category = 'cd';
UPDATE tier_thresholds SET target_pct_bp = 1800, solid_pct_bp = 2500 WHERE category = 'game';

-- Add the cheap/solid threshold to offer_engine_config.
INSERT INTO offer_engine_config (key, value)
VALUES ('solid_tier_min_price_cents', to_jsonb(1500))
ON CONFLICT (key) DO UPDATE SET value = to_jsonb(1500);

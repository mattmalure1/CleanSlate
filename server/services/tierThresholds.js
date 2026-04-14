// ============================================================
// tierThresholds.js
// Loads tier_thresholds and offer_engine_config tables once at
// server startup into in-memory caches. Exposes sync accessors
// so the offer engine stays pure.
//
// Fail-fast: throws at startup if either table is empty or
// unreachable — the server must not boot with missing config,
// otherwise the engine produces garbage offers silently.
//
// TODO: Add reloadThresholds() endpoint in admin sprint —
// cache is load-once-at-boot. Any admin edits to tier_thresholds
// or offer_engine_config will require a server restart until
// that endpoint exists.
// ============================================================

const { supabase } = require('./supabase');

// category -> { T1: {...}, T2: {...}, ... }
const tierCache = new Map();
// key -> value (unwrapped from jsonb)
const configCache = new Map();
// Gated items: { brands: ['disney', ...], asins: new Set(['B00...', ...]) }
const gatedCache = { brands: [], asins: new Set() };

let loaded = false;

async function loadThresholds() {
  if (!supabase) {
    throw new Error(
      '[tierThresholds] Supabase client not configured. ' +
      'Set SUPABASE_URL and SUPABASE_SERVICE_KEY in .env.'
    );
  }

  // --- tier_thresholds ---
  const { data: tiers, error: tierErr } = await supabase
    .from('tier_thresholds')
    .select('*');

  if (tierErr) {
    throw new Error(`[tierThresholds] Failed to load tier_thresholds: ${tierErr.message}`);
  }
  if (!tiers || tiers.length === 0) {
    throw new Error(
      '[tierThresholds] tier_thresholds table is empty — run migration ' +
      '2026-04-10_engine_spec_alignment.sql before starting the server.'
    );
  }

  tierCache.clear();
  for (const row of tiers) {
    if (!tierCache.has(row.category)) tierCache.set(row.category, {});
    tierCache.get(row.category)[row.tier] = {
      category: row.category,
      tier: row.tier,
      min_rank_drops_90: row.min_rank_drops_90,
      max_rank_drops_90: row.max_rank_drops_90,
      bsr_ceiling: row.bsr_ceiling,
      roi_floor_percent: row.roi_floor_percent,
      min_flat_margin_cents: row.min_flat_margin_cents,
    };
  }

  // --- offer_engine_config ---
  const { data: configs, error: cfgErr } = await supabase
    .from('offer_engine_config')
    .select('key, value');

  if (cfgErr) {
    throw new Error(`[tierThresholds] Failed to load offer_engine_config: ${cfgErr.message}`);
  }
  if (!configs || configs.length === 0) {
    throw new Error(
      '[tierThresholds] offer_engine_config table is empty — run migration ' +
      '2026-04-10_engine_spec_alignment.sql before starting the server.'
    );
  }

  configCache.clear();
  for (const row of configs) {
    configCache.set(row.key, row.value);
  }

  // --- gated_items (optional — don't crash if table doesn't exist yet) ---
  gatedCache.brands = [];
  gatedCache.asins.clear();
  try {
    const { data: gated, error: gatedErr } = await supabase
      .from('gated_items')
      .select('pattern, match_type')
      .eq('active', true);

    if (!gatedErr && gated) {
      for (const row of gated) {
        if (row.match_type === 'brand') {
          gatedCache.brands.push(row.pattern.toLowerCase());
        } else if (row.match_type === 'asin') {
          gatedCache.asins.add(row.pattern.toUpperCase());
        }
      }
    }
  } catch (_) {
    // Table may not exist yet — non-fatal, fall back to hardcoded in engine
    console.warn('[tierThresholds] gated_items table not found — using hardcoded fallback');
  }

  loaded = true;
  console.log(
    `[tierThresholds] Loaded ${tiers.length} tier rows across ${tierCache.size} categories, ` +
    `${configs.length} config keys, ${gatedCache.brands.length} gated brands, ${gatedCache.asins.size} gated ASINs.`
  );
}

// Return the ordered tier list for a category (T1 -> T4, highest rank-drop floor first).
// Engine walks this list and picks the first tier where rank_drops >= min_rank_drops_90.
function getTiersForCategory(category) {
  if (!loaded) {
    throw new Error('[tierThresholds] getTiersForCategory() called before loadThresholds()');
  }
  const tiers = tierCache.get(category);
  if (!tiers) return null;
  // Order: T1 first (strictest), T4 last (loosest).
  return Object.values(tiers).sort((a, b) => b.min_rank_drops_90 - a.min_rank_drops_90);
}

// Return a specific (category, tier) row or null.
function getTier(category, tier) {
  if (!loaded) {
    throw new Error('[tierThresholds] getTier() called before loadThresholds()');
  }
  return tierCache.get(category)?.[tier] || null;
}

// Return a config value by key. Throws if key is missing (fail-loud vs silent garbage).
function getConfig(key) {
  if (!loaded) {
    throw new Error('[tierThresholds] getConfig() called before loadThresholds()');
  }
  if (!configCache.has(key)) {
    throw new Error(`[tierThresholds] Missing config key: "${key}". Check offer_engine_config seed.`);
  }
  return configCache.get(key);
}

// Return the loaded gated items cache.
function getGatedBrands() {
  return gatedCache.brands;
}

function getGatedAsins() {
  return gatedCache.asins;
}

// Test-only injection — lets unit tests bypass Supabase.
// Do not call from production code.
function _injectForTests({ tiers, config, gated }) {
  tierCache.clear();
  configCache.clear();
  gatedCache.brands = [];
  gatedCache.asins.clear();
  for (const row of tiers) {
    if (!tierCache.has(row.category)) tierCache.set(row.category, {});
    tierCache.get(row.category)[row.tier] = row;
  }
  for (const [k, v] of Object.entries(config)) {
    configCache.set(k, v);
  }
  if (gated) {
    for (const g of gated) {
      if (g.match_type === 'brand') gatedCache.brands.push(g.pattern.toLowerCase());
      else if (g.match_type === 'asin') gatedCache.asins.add(g.pattern.toUpperCase());
    }
  }
  loaded = true;
}

module.exports = {
  loadThresholds,
  getTiersForCategory,
  getTier,
  getConfig,
  getGatedBrands,
  getGatedAsins,
  _injectForTests,
};

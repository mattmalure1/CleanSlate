const fetch = require('node-fetch');
const zlib = require('zlib');

const KEEPA_API_KEY = process.env.KEEPA_API_KEY;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// In-memory cache: code -> { data, cachedAt }
const cache = new Map();
// In-flight request dedup: code -> Promise — prevents duplicate Keepa API calls
// when the same barcode is scanned twice before the first response returns.
const pending = new Map();
let cacheHits = 0;
let cacheMisses = 0;

/**
 * Lookup a product by barcode/ISBN/UPC via Keepa API.
 * Results are cached for 24 hours.
 *
 * @param {string} code
 * @param {object} [opts]
 * @param {boolean} [opts.forceRefresh=false] If true, bypass the cache and
 *   fetch fresh data from Keepa. Used by the Quote Debugger's
 *   "Force Re-fetch from Keepa" checkbox.
 * @returns {Promise<object>} The Keepa response object. When the debug
 *   debugMeta option is true, the object is augmented with
 *   `_cacheMeta: { hit, cachedAt, ageMs }` for the debugger UI.
 */
async function lookupByCode(code, opts = {}) {
  const { forceRefresh = false, debugMeta = false, lean = false } = opts;

  // Check cache first (skipped on force refresh)
  if (!forceRefresh) {
    const cached = cache.get(code);
    if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
      cacheHits++;
      if (debugMeta) {
        return {
          ...cached.data,
          _cacheMeta: {
            hit: true,
            cachedAt: cached.cachedAt,
            ageMs: Date.now() - cached.cachedAt,
            forceRefresh: false,
          },
        };
      }
      return cached.data;
    }
  }

  // Dedup: if another request for the same code is already in flight, piggyback.
  if (!forceRefresh && pending.has(code)) {
    cacheHits++; // counts as a "hit" from the caller's perspective
    const data = await pending.get(code);
    if (debugMeta) {
      return { ...data, _cacheMeta: { hit: true, cachedAt: Date.now(), ageMs: 0, forceRefresh: false, deduped: true } };
    }
    return data;
  }

  cacheMisses++;

  // Two Keepa request sizes:
  //
  // LEAN (customer quotes): stats + buybox only. No offers array, no CSV history.
  //   Response: ~10-20KB → fast parse, fast transfer.
  //   The engine only reads stats.current[32], stats.avg90[32], salesRankDrops90,
  //   packageWeight/dims, categoryTree — all returned without offers or days params.
  //   fba_offer_count defaults to 0 if newOffersFBA isn't in the response
  //   (safe: competition check won't false-reject, just won't apply the crowded penalty).
  //
  // FULL (admin debugger, product review): includes offers=20 + days=180.
  //   Response: ~100-300KB → slower but has individual seller offers for debugging.
  //
  const url = lean
    ? `https://api.keepa.com/product?key=${KEEPA_API_KEY}&domain=1&code=${code}&stats=180&buybox=1`
    : `https://api.keepa.com/product?key=${KEEPA_API_KEY}&domain=1&code=${code}&offers=20&days=180&stats=180&buybox=1`;

  const fetchPromise = (async () => {
    const response = await fetch(url, {
      headers: { 'Accept-Encoding': 'gzip, deflate' },
    });

    if (!response.ok) {
      throw new Error(`Keepa API error: ${response.status} ${response.statusText}`);
    }

    let data;
    const contentEncoding = response.headers.get('content-encoding');
    if (contentEncoding === 'gzip') {
      const buffer = await response.buffer();
      try {
        const decompressed = zlib.gunzipSync(buffer);
        data = JSON.parse(decompressed.toString());
      } catch (e) {
        data = JSON.parse(buffer.toString());
      }
    } else {
      data = await response.json();
    }

    // Cache the result
    const cachedAt = Date.now();
    cache.set(code, { data, cachedAt });
    return data;
  })();

  // Register the in-flight promise so concurrent callers can piggyback
  pending.set(code, fetchPromise);
  try {
    const data = await fetchPromise;
    if (debugMeta) {
      return { ...data, _cacheMeta: { hit: false, cachedAt: Date.now(), ageMs: 0, forceRefresh } };
    }
    return data;
  } finally {
    pending.delete(code);
  }
}

/**
 * Returns cache statistics.
 */
function getCacheStats() {
  const total = cacheHits + cacheMisses;
  return {
    size: cache.size,
    hits: cacheHits,
    misses: cacheMisses,
    hitRate: total > 0 ? (cacheHits / total).toFixed(3) : '0.000',
  };
}

// Fast lookup — fewer params, lower token cost, faster response
// Used for customer-facing quotes where we don't need full stats/offers
async function lookupByCodeFast(code) {
  // Check full cache first — if we already have the full data, use it
  const cached = cache.get(code);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    cacheHits++;
    return cached.data;
  }

  // Also check fast cache
  const fastCached = cache.get('fast_' + code);
  if (fastCached && Date.now() - fastCached.cachedAt < CACHE_TTL_MS) {
    cacheHits++;
    return fastCached.data;
  }

  cacheMisses++;

  // Lighter request — no offers array, shorter stats window
  const url = `https://api.keepa.com/product?key=${KEEPA_API_KEY}&domain=1&code=${code}&stats=180`;

  const response = await fetch(url, {
    headers: { 'Accept-Encoding': 'gzip, deflate' },
  });

  if (!response.ok) {
    throw new Error(`Keepa API error: ${response.status} ${response.statusText}`);
  }

  let data;
  const contentEncoding = response.headers.get('content-encoding');
  if (contentEncoding === 'gzip') {
    const buffer = await response.buffer();
    try {
      const decompressed = zlib.gunzipSync(buffer);
      data = JSON.parse(decompressed.toString());
    } catch (e) {
      data = JSON.parse(buffer.toString());
    }
  } else {
    data = await response.json();
  }

  // Cache as fast result
  cache.set('fast_' + code, { data, cachedAt: Date.now() });

  return data;
}

module.exports = { lookupByCode, lookupByCodeFast, getCacheStats };

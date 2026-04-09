const fetch = require('node-fetch');
const zlib = require('zlib');

const KEEPA_API_KEY = process.env.KEEPA_API_KEY;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// In-memory cache: code -> { data, cachedAt }
const cache = new Map();
let cacheHits = 0;
let cacheMisses = 0;

/**
 * Lookup a product by barcode/ISBN/UPC via Keepa API.
 * Results are cached for 24 hours.
 */
async function lookupByCode(code) {
  // Check cache first
  const cached = cache.get(code);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    cacheHits++;
    return cached.data;
  }

  cacheMisses++;

  const url = `https://api.keepa.com/product?key=${KEEPA_API_KEY}&domain=1&code=${code}&offers=20&days=180&stats=365&buybox=1`;

  const response = await fetch(url, {
    headers: {
      'Accept-Encoding': 'gzip, deflate',
    },
  });

  if (!response.ok) {
    throw new Error(`Keepa API error: ${response.status} ${response.statusText}`);
  }

  let data;

  // node-fetch v2 handles gzip automatically in most cases via Accept-Encoding,
  // but we add explicit zlib fallback for edge cases
  const contentEncoding = response.headers.get('content-encoding');
  if (contentEncoding === 'gzip') {
    const buffer = await response.buffer();
    try {
      const decompressed = zlib.gunzipSync(buffer);
      data = JSON.parse(decompressed.toString());
    } catch (e) {
      // If gunzip fails, the buffer may already be decompressed by node-fetch
      data = JSON.parse(buffer.toString());
    }
  } else {
    data = await response.json();
  }

  // Cache the result
  cache.set(code, { data, cachedAt: Date.now() });

  return data;
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

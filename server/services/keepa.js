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

module.exports = { lookupByCode, getCacheStats };

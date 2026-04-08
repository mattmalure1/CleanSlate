const express = require('express');
const router = express.Router();
const keepa = require('../services/keepa');
const engine = require('../services/offerEngine');

// Parse Keepa offers into SellerAmp-style competition data
// Only includes currently active offers (seen in last 2 days)
function parseOffers(product) {
  const raw = product.offers || [];
  const CONDITIONS = ['', 'New', 'Like New', 'Very Good', 'Good', 'Acceptable'];
  const KEEPA_EPOCH = 1293840000000; // 2011-01-01 in ms
  const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;
  const now = Date.now();

  const offers = [];
  for (const o of raw) {
    // Filter: only currently active offers (lastSeen within 2 days)
    if (o.lastSeen) {
      const lastSeenMs = KEEPA_EPOCH + o.lastSeen * 60000;
      if (now - lastSeenMs > TWO_DAYS_MS) continue;
    }

    const csv = o.offerCSV || [];
    let price = -1, shipping = 0;
    for (let i = csv.length - 2; i >= 1; i -= 3) {
      if (csv[i] > 0) { price = csv[i]; shipping = csv[i + 1] > 0 ? csv[i + 1] : 0; break; }
    }
    if (price <= 0) continue;
    offers.push({
      price, shipping, total: price + shipping,
      condition: CONDITIONS[o.condition] || '?',
      conditionNum: o.condition,
      isFBA: !!o.isFBA,
      isPrime: !!o.isPrime,
      isAmazon: !!o.isAmazon,
      sellerId: o.sellerId || null,
    });
  }
  offers.sort((a, b) => a.total - b.total);

  const usedFBA = offers.filter(o => o.conditionNum >= 2 && o.isFBA);
  const usedFBM = offers.filter(o => o.conditionNum >= 2 && !o.isFBA);
  const newOffers = offers.filter(o => o.conditionNum === 1);
  const newFBA = newOffers.filter(o => o.isFBA);
  const newFBM = newOffers.filter(o => !o.isFBA);

  return {
    summary: {
      totalActive: offers.length,
      newFBA: newFBA.length,
      newFBM: newFBM.length,
      usedFBA: usedFBA.length,
      usedFBM: usedFBM.length,
    },
    // Top offers per category (capped at 10 each)
    usedFBA: usedFBA.slice(0, 10).map(o => ({ price: o.price, shipping: o.shipping, total: o.total, condition: o.condition, sellerId: o.sellerId })),
    usedFBM: usedFBM.slice(0, 10).map(o => ({ price: o.price, shipping: o.shipping, total: o.total, condition: o.condition, sellerId: o.sellerId })),
    newFBA: newFBA.slice(0, 5).map(o => ({ price: o.price, total: o.total, sellerId: o.sellerId })),
    newFBM: newFBM.slice(0, 5).map(o => ({ price: o.price, shipping: o.shipping, total: o.total, sellerId: o.sellerId })),
    // Buy Box info
    buyBoxIsAmazon: product.stats?.buyBoxIsAmazon ?? null,
    buyBoxIsFBA: product.stats?.buyBoxIsFBA ?? null,
    buyBoxIsUsed: product.stats?.buyBoxIsUsed ?? null,
  };
}

// GET /api/admin/review?code=ISBN_OR_UPC
// Returns full internal pricing breakdown for admin dashboard
router.get('/api/admin/review', async (req, res) => {
  try {
    const code = (req.query.code || '').replace(/[^a-zA-Z0-9]/g, '');
    const hasCase = req.query.hasCase !== 'false';

    if (!code) {
      return res.status(400).json({ error: 'Missing code parameter' });
    }

    const keepaResponse = await keepa.lookupByCode(code);

    if (!keepaResponse.products || keepaResponse.products.length === 0) {
      return res.status(404).json({ error: "Product not found in Keepa" });
    }

    const product = keepaResponse.products[0];
    const scoutingOffer = engine.calculateOffer(product, hasCase, 'scouting');
    const buybackOffer = engine.calculateOffer(product, hasCase, 'buyback');
    const debug = scoutingOffer._debug || {};

    const scoutDebug = scoutingOffer._debug || {};
    const buybackDebug = buybackOffer._debug || {};

    res.json({
      product: {
        title: product.title || 'Unknown',
        asin: product.asin || null,
        imageUrl: product.imagesCSV ? `https://images-na.ssl-images-amazon.com/images/I/${product.imagesCSV.split(',')[0]}` : null,
        category: scoutingOffer.category,
        isDisc: scoutingOffer.isDisc,
        weightLbs: scoutDebug.weightLbs || null,
        weightGrams: product.packageWeight || product.itemWeight || null,
      },
      // Scouting view: FBA Slot trigger-based pricing (your profit analysis)
      scouting: {
        sellPrice: scoutDebug.sellPrice || null,
        priceSource: scoutDebug.priceSource || null,
        fees: scoutDebug.fees || null,
        profitAnalysis: scoutDebug.profitAnalysis || null,
        offer: {
          offerCents: scoutingOffer.offerCents,
          offerDisplay: scoutingOffer.offerDisplay,
          status: scoutingOffer.status,
          color: scoutingOffer.color || null,
          label: scoutingOffer.label || null,
          reason: scoutingOffer.reason || null,
        },
      },
      // Buyback view: Buy Box Used avg pricing (customer-facing competitive offer)
      buyback: {
        sellPrice: buybackDebug.sellPrice || null,
        priceSource: buybackDebug.priceSource || null,
        fees: buybackDebug.fees || null,
        profitAnalysis: buybackDebug.profitAnalysis || null,
        offer: {
          offerCents: buybackOffer.offerCents,
          offerDisplay: buybackOffer.offerDisplay,
          status: buybackOffer.status,
          color: buybackOffer.color || null,
          label: buybackOffer.label || null,
          reason: buybackOffer.reason || null,
        },
      },
      velocity: scoutDebug.velocity || null,
      // Parsed offers for SellerAmp-style display
      competition: parseOffers(product),
      cache: keepa.getCacheStats(),
      keepaTokensLeft: keepaResponse.tokensLeft || null,
    });
  } catch (err) {
    console.error('Admin review error:', err.message);
    res.status(500).json({ error: 'Failed to review item: ' + err.message });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const keepa = require('../services/keepa');
const engine = require('../services/offerEngine');
const tt = require('../services/tierThresholds');

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

// TODO: Remove Product Review page in Sprint 3 — superseded by /admin/debug-quote
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

// ============================================================
// GET /api/admin/debug-quote?code=X&forceRefresh=true
// Spec: CLEANSLATE_UI.md §5 — Quote Debugger
//
// Returns everything the debugger needs to render the full trace of
// a quote calculation: raw Keepa, cache metadata, extracted fields,
// tier + config context, and the complete CalculationTrace emitted by
// the 11-step engine.
// ============================================================
router.get('/api/admin/debug-quote', async (req, res) => {
  try {
    const code = (req.query.code || '').replace(/[^a-zA-Z0-9]/g, '');
    const forceRefresh = req.query.forceRefresh === 'true';
    if (!code) return res.status(400).json({ error: 'Missing code parameter' });

    const started = Date.now();
    const keepaResponse = await keepa.lookupByCode(code, { forceRefresh, debugMeta: true });

    if (!keepaResponse.products || keepaResponse.products.length === 0) {
      return res.status(404).json({ error: "Product not found in Keepa", code });
    }

    const product = keepaResponse.products[0];
    const cacheMeta = keepaResponse._cacheMeta || null;

    // Strip cache meta from the raw payload we return (keep it in its own field)
    const rawProductCopy = { ...product };

    // Run the spec-aligned engine end-to-end
    const extracted = engine.extractKeepaFields(product);
    const gatedResult = engine.isGated(product);
    const engineResult = engine.runOfferEngine(product, extracted, { gatedResult });

    // Snapshot the live tier + config context so the debugger can
    // render the actual values in play for this calculation.
    const category = engineResult.calculation_trace?.category
      || engine.detectCategory(extracted.category_tree)
      || null;
    const tiersForCategory = category ? tt.getTiersForCategory(category) : null;

    // Known config keys used by the engine — kept in sync with spec §1.9
    const CONFIG_KEYS = [
      'closing_fee_cents', 'prep_cost_cents', 'rejection_return_overhead_cents',
      'inbound_per_lb_cents', 'disc_buffer_cents', 'storage_reserve_cents',
      'media_mail_receive_cents', 'max_copies_per_asin', 'referral_fee_rate',
    ];
    const configSnapshot = {};
    for (const k of CONFIG_KEYS) {
      try { configSnapshot[k] = tt.getConfig(k); } catch (_) { configSnapshot[k] = null; }
    }

    res.json({
      code,
      fetchedAt: new Date().toISOString(),
      elapsedMs: Date.now() - started,
      cacheMeta,
      keepaTokensLeft: keepaResponse.tokensLeft ?? null,
      product: {
        asin: product.asin || null,
        title: product.title || null,
        imageUrl: product.imagesCSV
          ? `https://images-na.ssl-images-amazon.com/images/I/${product.imagesCSV.split(',')[0]}`
          : null,
      },
      extractedFields: extracted,
      result: {
        accepted: engineResult.accepted,
        offer_cents: engineResult.offer_cents ?? null,
        tier: engineResult.tier ?? null,
        rejection_reason: engineResult.rejection_reason ?? null,
        rejection_step: engineResult.calculation_trace?.rejection_step ?? null,
      },
      calculationTrace: engineResult.calculation_trace,
      tiersForCategory,
      configSnapshot,
      gatedResult,
      rawKeepa: rawProductCopy,
    });
  } catch (err) {
    console.error('Debug quote error:', err.message);
    res.status(500).json({ error: 'Failed to debug quote: ' + err.message });
  }
});

// ============================================================
// Gated Items CRUD — /api/admin/gated-items
// Manage the gated_items table (brands/ASINs Matt can't sell on Amazon)
// ============================================================
const db = require('../services/supabase');

// GET /api/admin/gated-items — list all gated items
router.get('/api/admin/gated-items', async (req, res) => {
  try {
    if (!db.supabase) return res.status(503).json({ error: 'Database not configured' });
    const { data, error } = await db.supabase
      .from('gated_items')
      .select('*')
      .order('added_at', { ascending: false });
    if (error) throw new Error(error.message);
    res.json({ items: data || [] });
  } catch (err) {
    console.error('List gated items error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/gated-items — add a new gated brand or ASIN
router.post('/api/admin/gated-items', async (req, res) => {
  try {
    if (!db.supabase) return res.status(503).json({ error: 'Database not configured' });
    const { pattern, match_type, reason } = req.body;
    if (!pattern || !match_type) {
      return res.status(400).json({ error: 'pattern and match_type are required' });
    }
    if (!['brand', 'asin'].includes(match_type)) {
      return res.status(400).json({ error: 'match_type must be "brand" or "asin"' });
    }
    const { data, error } = await db.supabase
      .from('gated_items')
      .insert({
        pattern: match_type === 'asin' ? pattern.toUpperCase() : pattern.toLowerCase(),
        match_type,
        reason: reason || 'Brand gated on Amazon',
        added_by: 'admin',
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    res.json({ item: data });
  } catch (err) {
    console.error('Add gated item error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/gated-items/:id — remove (deactivate) a gated item
router.delete('/api/admin/gated-items/:id', async (req, res) => {
  try {
    if (!db.supabase) return res.status(503).json({ error: 'Database not configured' });
    const { error } = await db.supabase
      .from('gated_items')
      .update({ active: false })
      .eq('id', req.params.id);
    if (error) throw new Error(error.message);
    res.json({ ok: true });
  } catch (err) {
    console.error('Delete gated item error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/gated-items/:id/reactivate — re-enable a deactivated item
router.post('/api/admin/gated-items/:id/reactivate', async (req, res) => {
  try {
    if (!db.supabase) return res.status(503).json({ error: 'Database not configured' });
    const { error } = await db.supabase
      .from('gated_items')
      .update({ active: true })
      .eq('id', req.params.id);
    if (error) throw new Error(error.message);
    res.json({ ok: true });
  } catch (err) {
    console.error('Reactivate gated item error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

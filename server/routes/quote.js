const express = require('express');
const router = express.Router();
const keepa = require('../services/keepa');
const { calculateOffer, runOfferEngine, extractKeepaFields, isGated } = require('../services/offerEngine');
const db = require('../services/supabase');
const { notifyQuoteSubmitted } = require('../services/email');

// GET /api/quote?code=ISBN_OR_UPC&hasCase=true
router.get('/api/quote', async (req, res) => {
  try {
    const { hasCase, condition } = req.query;
    const code = (req.query.code || '').replace(/[^a-zA-Z0-9]/g, '');

    if (!code) {
      return res.status(400).json({ error: 'Missing required parameter: code' });
    }

    // lean: true → skips offers array + CSV history. Response is ~10-20KB
    // instead of ~100-300KB. Cuts Keepa response time from 10-15s to 1-3s.
    const keepaResponse = await keepa.lookupByCode(code, { lean: true });

    if (!keepaResponse.products || keepaResponse.products.length === 0) {
      return res.status(404).json({ error: "We couldn't find this item" });
    }

    const product = keepaResponse.products[0];
    const hasCaseBool = hasCase !== 'false';

    // Run the engine once, then pass the result to the legacy wrapper to avoid
    // running the 11-step algorithm twice per request.
    const extracted = extractKeepaFields(product);
    const gatedResult = isGated(product);
    const engineResult = runOfferEngine(product, extracted, { gatedResult });
    const offer = calculateOffer(product, hasCaseBool, 'buyback', null, { extracted, gatedResult, engineResult });

    res.json({
      status: offer.status,
      color: offer.color || null,
      label: offer.label || null,
      offerCents: offer.offerCents || 0,
      offerDisplay: offer.offerDisplay || '$0.00',
      category: offer.category || null,
      isDisc: offer.isDisc || false,
      hasCase: offer.hasCase != null ? offer.hasCase : hasCaseBool,
      title: offer.title || null,
      asin: offer.asin || null,
      imageUrl: offer.imageUrl || null,
      message: offer.message || null,
      reason: offer.reason || null,
      tier: offer.tier || null,
    });

    // Fire-and-forget: legacy quote_log for conversion analytics
    db.logQuote({
      barcode: code, asin: offer.asin, title: offer.title, category: offer.category,
      condition: 'good', hasCase: hasCaseBool, sellPriceCents: offer._debug?.sellPrice || null,
      offerCents: offer.offerCents, status: 'quoted', quoteColor: offer.color,
      pricingMode: 'buyback', sessionId: null,
    }).catch(err => console.error('Quote log error:', err.message));

    // Fire-and-forget: new quote_items with full calculation_trace (spec §1.2).
    // Powers the Quote Debugger and rejection-reason analytics.
    db.logQuoteItem({ upc: code, offerOutput: engineResult })
      .catch(err => console.error('Quote item log error:', err.message));

    // Fire-and-forget email notification to Matt
    notifyQuoteSubmitted({
      code, title: offer.title, asin: offer.asin, category: offer.category,
      status: offer.status, offerCents: offer.offerCents, offerDisplay: offer.offerDisplay,
      tier: offer.tier, genre: offer.genre, bundleLabel: offer.bundleLabel,
    }).catch(err => console.error('Email notify error:', err.message));
  } catch (err) {
    console.error('Quote error:', err.message);
    res.status(500).json({ error: 'Failed to get quote. Please try again.' });
  }
});

// GET /api/requote?code=ISBN_OR_UPC&hasCase=false
router.get('/api/requote', async (req, res) => {
  try {
    const { hasCase } = req.query;
    const code = (req.query.code || '').replace(/[^a-zA-Z0-9]/g, '');

    if (!code) {
      return res.status(400).json({ error: 'Missing required parameter: code' });
    }

    // This will hit cache if the code was recently looked up
    const keepaResponse = await keepa.lookupByCode(code, { lean: true });

    if (!keepaResponse.products || keepaResponse.products.length === 0) {
      return res.status(404).json({ error: "We couldn't find this item" });
    }

    const product = keepaResponse.products[0];
    const hasCaseBool = hasCase !== 'false'; // default true
    const offer = calculateOffer(product, hasCaseBool);

    res.json({
      status: offer.status,
      color: offer.color || null,
      label: offer.label || null,
      offerCents: offer.offerCents || 0,
      offerDisplay: offer.offerDisplay || '$0.00',
      category: offer.category || null,
      isDisc: offer.isDisc || false,
      hasCase: offer.hasCase != null ? offer.hasCase : hasCaseBool,
      title: offer.title || null,
      asin: offer.asin || null,
      imageUrl: offer.imageUrl || null,
      message: offer.message || null,
      reason: offer.reason || null,
    });
  } catch (err) {
    console.error('Requote error:', err.message);
    res.status(500).json({ error: 'Failed to get requote. Please try again.' });
  }
});

// POST /api/bulk-quote — look up multiple ISBNs/UPCs at once
// Body: { codes: ["isbn1", "isbn2", ...], hasCase: true }
// Processes sequentially to respect Keepa rate limits, returns array of results
router.post('/api/bulk-quote', async (req, res) => {
  try {
    const { codes, hasCase, condition } = req.body;
    if (!codes || !Array.isArray(codes) || codes.length === 0) {
      return res.status(400).json({ error: 'Missing codes array' });
    }
    if (codes.length > 50) {
      return res.status(400).json({ error: 'Maximum 50 items per bulk request' });
    }

    const hasCaseBool = hasCase !== false;
    // NOTE: condition param is deprecated in the engine (spec §4.1 uses blended buybox).
    // We still accept it from the client for API compatibility but it is ignored.
    // eslint-disable-next-line no-unused-vars
    const _deprecatedCondition = condition;
    const results = [];

    for (const rawCode of codes) {
      const code = String(rawCode).replace(/[^a-zA-Z0-9]/g, '');
      if (!code) {
        results.push({ code: rawCode, status: 'rejected', reason: 'invalid_code', message: 'Invalid barcode', offerCents: 0, offerDisplay: '$0.00' });
        continue;
      }

      try {
        const keepaResponse = await keepa.lookupByCode(code, { lean: true });
        if (!keepaResponse.products || keepaResponse.products.length === 0) {
          results.push({ code, status: 'rejected', reason: 'not_found', message: "We couldn't find this item", offerCents: 0, offerDisplay: '$0.00' });
          continue;
        }

        const product = keepaResponse.products[0];
        const extracted = extractKeepaFields(product);
        const gatedResult = isGated(product);
        const engineResult = runOfferEngine(product, extracted, { gatedResult });
        const offer = calculateOffer(product, hasCaseBool, 'buyback', null, { extracted, gatedResult, engineResult });

        // Fire-and-forget quote_items logging (reuses the already-computed result)
        db.logQuoteItem({ upc: code, offerOutput: engineResult })
          .catch(err => console.error('Bulk quote item log error:', err.message));

        results.push({
          code,
          status: offer.status,
          color: offer.color || null,
          label: offer.label || null,
          offerCents: offer.offerCents || 0,
          offerDisplay: offer.offerDisplay || '$0.00',
          category: offer.category || null,
          isDisc: offer.isDisc || false,
          hasCase: offer.hasCase != null ? offer.hasCase : hasCaseBool,
          title: offer.title || null,
          asin: offer.asin || null,
          imageUrl: offer.imageUrl || null,
          message: offer.message || null,
          reason: offer.reason || null,
        });
      } catch (err) {
        results.push({ code, status: 'rejected', reason: 'error', message: 'Lookup failed — try again', offerCents: 0, offerDisplay: '$0.00' });
      }
    }

    const accepted = results.filter(r => r.status === 'accepted' || r.status === 'low');
    const totalCents = accepted.reduce((sum, r) => sum + r.offerCents, 0);

    res.json({
      results,
      summary: {
        total: results.length,
        accepted: accepted.length,
        rejected: results.length - accepted.length,
        totalOfferCents: totalCents,
        totalOfferDisplay: `$${(totalCents / 100).toFixed(2)}`,
      },
    });
  } catch (err) {
    console.error('Bulk quote error:', err.message);
    res.status(500).json({ error: 'Bulk lookup failed' });
  }
});

module.exports = router;

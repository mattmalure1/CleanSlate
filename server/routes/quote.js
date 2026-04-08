const express = require('express');
const router = express.Router();
const keepa = require('../services/keepa');
const { calculateOffer } = require('../services/offerEngine');
const db = require('../services/supabase');

// GET /api/quote?code=ISBN_OR_UPC&hasCase=true
router.get('/api/quote', async (req, res) => {
  try {
    const { hasCase, condition } = req.query;
    const code = (req.query.code || '').replace(/[^a-zA-Z0-9]/g, '');

    if (!code) {
      return res.status(400).json({ error: 'Missing required parameter: code' });
    }

    const keepaResponse = await keepa.lookupByCode(code);

    if (!keepaResponse.products || keepaResponse.products.length === 0) {
      return res.status(404).json({ error: "We couldn't find this item" });
    }

    const product = keepaResponse.products[0];
    const hasCaseBool = hasCase !== 'false';
    // Default to "good" condition — customers don't pick condition, we assess after receiving
    const offer = calculateOffer(product, hasCaseBool, 'buyback', 'good');

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

    // Fire-and-forget quote logging
    db.logQuote({
      barcode: code, asin: offer.asin, title: offer.title, category: offer.category,
      condition: 'good', hasCase: hasCaseBool, sellPriceCents: offer._debug?.sellPrice || null,
      offerCents: offer.offerCents, status: 'quoted', quoteColor: offer.color,
      pricingMode: 'buyback', sessionId: null,
    }).catch(err => console.error('Quote log error:', err.message));
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
    const keepaResponse = await keepa.lookupByCode(code);

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
    const validConditions = ['new_sealed', 'like_new', 'good', 'acceptable'];
    const cond = validConditions.includes(condition) ? condition : null;
    const results = [];

    for (const rawCode of codes) {
      const code = String(rawCode).replace(/[^a-zA-Z0-9]/g, '');
      if (!code) {
        results.push({ code: rawCode, status: 'rejected', reason: 'invalid_code', message: 'Invalid barcode', offerCents: 0, offerDisplay: '$0.00' });
        continue;
      }

      try {
        const keepaResponse = await keepa.lookupByCode(code);
        if (!keepaResponse.products || keepaResponse.products.length === 0) {
          results.push({ code, status: 'rejected', reason: 'not_found', message: "We couldn't find this item", offerCents: 0, offerDisplay: '$0.00' });
          continue;
        }

        const product = keepaResponse.products[0];
        const offer = calculateOffer(product, hasCaseBool, 'buyback', cond);
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

const express = require('express');
const router = express.Router();
const db = require('../services/supabase');

// GET /api/admin/quotes — list quote logs with filters and stats
router.get('/api/admin/quotes', async (req, res) => {
  try {
    const { search, category, status, limit, offset } = req.query;
    const [quotes, stats] = await Promise.all([
      db.listQuoteLogs({
        search: search || null,
        category: category || null,
        status: status || null,
        limit: parseInt(limit) || 100,
        offset: parseInt(offset) || 0,
      }),
      db.getQuoteStats(),
    ]);
    res.json({ quotes, stats });
  } catch (err) {
    console.error('Quote log list error:', err.message);
    res.status(500).json({ error: 'Failed to list quote logs' });
  }
});

module.exports = router;

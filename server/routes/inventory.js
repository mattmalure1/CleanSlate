const express = require('express');
const router = express.Router();
const db = require('../services/supabase');
const { requireAuth, requireAdmin } = require('../middleware/auth');

// All inventory routes are admin-only
router.use('/api/admin/inventory', requireAuth, requireAdmin);

// POST /api/admin/inventory/receive — create inventory from order or manual items
router.post('/api/admin/inventory/receive', async (req, res) => {
  try {
    const { orderId, items } = req.body;

    if (orderId) {
      // Bulk create from existing order
      const created = await db.bulkCreateInventory(orderId);
      // Update order status to received
      await db.updateOrderStatus(orderId, 'received').catch(err =>
        console.error('Failed to update order status:', err.message)
      );
      return res.json({ success: true, items: created, count: created.length });
    }

    if (items && Array.isArray(items) && items.length > 0) {
      // Manual creation
      const created = [];
      for (const item of items) {
        const sku = await db.generateSku(item.category);
        const row = await db.updateInventoryItem(sku, {}).catch(() => null);
        // Use supabase directly for insert since updateInventoryItem needs existing row
        const { supabase } = db;
        if (!supabase) {
          created.push({ sku, ...item, status: 'received' });
          continue;
        }
        const { data, error } = await supabase
          .from('inventory')
          .insert({
            sku,
            asin: item.asin || null,
            title: item.title || null,
            category: item.category || null,
            condition_received: item.conditionReceived || 'good',
            cost_cents: item.costCents || 0,
            status: 'received',
            received_at: new Date().toISOString(),
          })
          .select()
          .single();
        if (error) throw new Error('Failed to create inventory item: ' + error.message);
        created.push(data);
      }
      return res.json({ success: true, items: created, count: created.length });
    }

    return res.status(400).json({ error: 'Provide orderId or items array' });
  } catch (err) {
    console.error('Inventory receive error:', err.message);
    res.status(500).json({ error: 'Failed to receive inventory: ' + err.message });
  }
});

// GET /api/admin/inventory — list inventory with filters and stats
router.get('/api/admin/inventory', async (req, res) => {
  try {
    const { status, category, search, limit, offset } = req.query;
    const [items, stats] = await Promise.all([
      db.listInventory({
        status: status || null,
        category: category || null,
        search: search || null,
        limit: parseInt(limit) || 100,
        offset: parseInt(offset) || 0,
      }),
      db.getInventoryStats(),
    ]);
    res.json({ items, stats });
  } catch (err) {
    console.error('Inventory list error:', err.message);
    res.status(500).json({ error: 'Failed to list inventory' });
  }
});

// PATCH /api/admin/inventory/batch — batch status update (must be before :sku route)
router.patch('/api/admin/inventory/batch', async (req, res) => {
  try {
    const { skus, status } = req.body;
    if (!skus || !Array.isArray(skus) || !status) {
      return res.status(400).json({ error: 'skus array and status required' });
    }
    const updated = await db.batchUpdateInventoryStatus(skus, status);
    res.json({ success: true, updated: updated.length, items: updated });
  } catch (err) {
    console.error('Batch inventory update error:', err.message);
    res.status(500).json({ error: 'Batch update failed: ' + err.message });
  }
});

// PATCH /api/admin/inventory/:sku — update single inventory item
router.patch('/api/admin/inventory/:sku', async (req, res) => {
  try {
    const allowedFields = [
      'status', 'condition_graded', 'sell_price_cents', 'cost_cents',
      'fba_fee_cents', 'referral_fee_cents', 'inbound_ship_cents',
      'notes', 'amazon_listing_id',
    ];
    const updates = {};
    for (const key of allowedFields) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const item = await db.updateInventoryItem(req.params.sku, updates);
    if (!item) return res.status(404).json({ error: 'Inventory item not found' });
    res.json({ success: true, item });
  } catch (err) {
    console.error('Inventory update error:', err.message);
    res.status(500).json({ error: 'Failed to update inventory item: ' + err.message });
  }
});

// GET /api/admin/inventory/export — CSV export
router.get('/api/admin/inventory/export', async (req, res) => {
  try {
    const items = await db.listInventory({ limit: 10000, offset: 0 });

    const headers = [
      'SKU', 'ASIN', 'Title', 'Category', 'Condition Received', 'Condition Graded',
      'Cost', 'Sell Price', 'Expected Profit', 'Status', 'Days In Inventory',
      'Received', 'Graded', 'Listed', 'Sold', 'Notes',
    ];

    const rows = [headers];
    for (const item of items) {
      const daysInInventory = item.received_at
        ? Math.floor((Date.now() - new Date(item.received_at).getTime()) / 86400000)
        : 0;
      rows.push([
        item.sku || '',
        item.asin || '',
        item.title || '',
        item.category || '',
        item.condition_received || '',
        item.condition_graded || '',
        item.cost_cents != null ? (item.cost_cents / 100).toFixed(2) : '',
        item.sell_price_cents != null ? (item.sell_price_cents / 100).toFixed(2) : '',
        item.expected_profit_cents != null ? (item.expected_profit_cents / 100).toFixed(2) : '',
        item.status || '',
        daysInInventory,
        item.received_at ? new Date(item.received_at).toISOString().split('T')[0] : '',
        item.graded_at ? new Date(item.graded_at).toISOString().split('T')[0] : '',
        item.listed_at ? new Date(item.listed_at).toISOString().split('T')[0] : '',
        item.sold_at ? new Date(item.sold_at).toISOString().split('T')[0] : '',
        item.notes || '',
      ]);
    }

    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=cleanslate-inventory.csv');
    res.send(csv);
  } catch (err) {
    console.error('Inventory export error:', err.message);
    res.status(500).json({ error: 'Export failed' });
  }
});

module.exports = router;

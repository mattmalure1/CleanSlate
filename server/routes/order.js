const express = require('express');
const router = express.Router();
const db = require('../services/supabase');
const { requireAuth, requireAdmin } = require('../middleware/auth');

// POST /api/order — create a new order (persists to Supabase)
router.post('/api/order', async (req, res) => {
  try {
    const { items, totalCents, customer, payout } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'No items in order' });
    }
    if (!customer?.name || !customer?.email) {
      return res.status(400).json({ error: 'Name and email required' });
    }

    // Minimum order check — $8.00
    const orderTotal = totalCents || items.reduce((sum, i) => sum + (i.offerCents || 0), 0);
    if (orderTotal < 800) {
      return res.status(400).json({ error: 'Minimum order amount is $8.00' });
    }

    // Create/update customer in Supabase
    // Store phone inside the address jsonb field alongside street/city/state/zip
    const address = { ...(customer.address || {}) };
    if (customer.phone) address.phone = customer.phone;

    const customerId = await db.upsertCustomer({
      name: customer.name,
      email: customer.email,
      address,
      payoutMethod: payout?.method || 'paypal',
      payoutDetails: payout?.email || '',
    });

    // Create order with items
    const orderId = await db.createOrder({
      customerId,
      items,
      totalOfferCents: totalCents || items.reduce((sum, i) => sum + (i.offerCents || 0), 0),
    });

    if (!orderId) {
      // Supabase not configured — return a temp ID
      const crypto = require('crypto');
      return res.json({
        orderId: `CS-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
        status: 'pending',
        note: 'Database not connected — order not persisted',
      });
    }

    res.json({
      orderId,
      status: 'pending',
      itemCount: items.length,
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Order creation error:', err.message);
    res.status(500).json({ error: 'Failed to create order: ' + err.message });
  }
});

// GET /api/order/:id — get order status
router.get('/api/order/:id', async (req, res) => {
  try {
    const order = await db.getOrder(req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json({
      orderId: order.id,
      status: order.status,
      totalOfferCents: order.total_offer_cents,
      customer: {
        name: order.customers?.name,
        email: order.customers?.email,
      },
      items: (order.order_items || []).map(i => ({
        title: i.title,
        offerCents: i.offered_price_cents,
        category: i.category,
      })),
      trackingNumber: order.tracking_number,
      labelUrl: order.label_url,
      createdAt: order.created_at,
    });
  } catch (err) {
    console.error('Order lookup error:', err.message);
    res.status(500).json({ error: 'Failed to get order' });
  }
});

// PATCH /api/admin/order/:id — update order status/notes (admin only)
router.patch('/api/admin/order/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { status, notes } = req.body;
    const updates = {};
    if (status) updates.status = status;
    if (notes !== undefined) updates.notes = notes;

    const order = await db.updateOrderStatus(req.params.id, status, updates);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    // Auto-create inventory when order is received
    if (status === 'received') {
      db.bulkCreateInventory(req.params.id).catch(err => console.error('Auto-inventory error:', err.message));
    }

    res.json({ success: true, order });
  } catch (err) {
    console.error('Order update error:', err.message);
    res.status(500).json({ error: 'Failed to update order' });
  }
});

// GET /api/admin/orders — list orders with search, filter, stats
router.get('/api/admin/orders', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { limit, status, search } = req.query;
    const orders = await db.listOrders({
      limit: parseInt(limit) || 100,
      status: status || null,
    });

    // Filter by search query (name, email, order ID, tracking)
    let filtered = orders;
    if (search) {
      const q = search.toLowerCase();
      filtered = orders.filter(o =>
        o.id?.toLowerCase().includes(q) ||
        o.customers?.name?.toLowerCase().includes(q) ||
        o.customers?.email?.toLowerCase().includes(q) ||
        o.tracking_number?.toLowerCase().includes(q) ||
        (o.order_items || []).some(i => i.title?.toLowerCase().includes(q))
      );
    }

    // Compute stats from ALL orders (not filtered)
    const stats = {
      total: orders.length,
      pending: orders.filter(o => o.status === 'pending').length,
      label_created: orders.filter(o => o.status === 'label_created').length,
      shipped: orders.filter(o => o.status === 'shipped').length,
      received: orders.filter(o => o.status === 'received').length,
      grading: orders.filter(o => o.status === 'grading').length,
      graded: orders.filter(o => o.status === 'graded').length,
      paid: orders.filter(o => o.status === 'paid').length,
      cancelled: orders.filter(o => o.status === 'cancelled').length,
      totalPayoutCents: orders.filter(o => o.status !== 'cancelled').reduce((s, o) => s + (o.total_offer_cents || 0), 0),
      unpaidPayoutCents: orders.filter(o => !['paid', 'cancelled'].includes(o.status)).reduce((s, o) => s + (o.total_offer_cents || 0), 0),
      totalItems: orders.reduce((s, o) => s + (o.order_items?.length || 0), 0),
    };

    res.json({ orders: filtered, stats });
  } catch (err) {
    console.error('Orders list error:', err.message);
    res.status(500).json({ error: 'Failed to list orders' });
  }
});

// PATCH /api/admin/orders/batch — batch status update
router.patch('/api/admin/orders/batch', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { orderIds, status, payoutTransactionId } = req.body;
    if (!orderIds || !Array.isArray(orderIds) || !status) {
      return res.status(400).json({ error: 'orderIds array and status required' });
    }

    const results = [];
    for (const id of orderIds) {
      try {
        const extras = {};
        if (payoutTransactionId) extras.notes = `Payout: ${payoutTransactionId}`;
        const order = await db.updateOrderStatus(id, status, extras);
        results.push({ id, success: true });
      } catch (err) {
        results.push({ id, success: false, error: err.message });
      }
    }

    res.json({ results, updated: results.filter(r => r.success).length });
  } catch (err) {
    console.error('Batch update error:', err.message);
    res.status(500).json({ error: 'Batch update failed' });
  }
});

// GET /api/admin/orders/export — CSV export
router.get('/api/admin/orders/export', requireAuth, requireAdmin, async (req, res) => {
  try {
    const orders = await db.listOrders({ limit: 1000 });

    const rows = [['Order ID', 'Date', 'Status', 'Customer', 'Email', 'Payout Method', 'Items', 'Total Offer', 'Tracking', 'Notes']];
    for (const o of orders) {
      const c = o.customers || {};
      const items = (o.order_items || []).map(i => i.title).join('; ');
      rows.push([
        o.id,
        new Date(o.created_at).toISOString().split('T')[0],
        o.status,
        c.name || '',
        c.email || '',
        c.payout_method || '',
        items,
        (o.total_offer_cents / 100).toFixed(2),
        o.tracking_number || '',
        o.notes || '',
      ]);
    }

    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=cleanslate-orders.csv');
    res.send(csv);
  } catch (err) {
    console.error('Export error:', err.message);
    res.status(500).json({ error: 'Export failed' });
  }
});

// POST /api/label/:orderId — generate shipping label via Shippo
router.post('/api/label/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;

    // Get order from Supabase
    const order = await db.getOrder(orderId);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (order.label_url) {
      // Label already generated
      return res.json({
        orderId,
        trackingNumber: order.tracking_number,
        labelUrl: order.label_url,
        message: 'Label already generated',
      });
    }

    const shippo = require('../services/shippo');

    // Estimate weight from items (default 1lb per item, rough estimate)
    const itemCount = (order.order_items || []).length;
    const estimatedWeightLbs = Math.max(1, itemCount * 1.5);

    const customerAddress = order.customers?.address || {};
    const label = await shippo.createLabel({
      customer: {
        name: order.customers?.name || 'Customer',
        email: order.customers?.email || '',
        phone: customerAddress.phone || '',
        address: customerAddress,
      },
      weightLbs: estimatedWeightLbs,
    });

    // Update order with tracking info
    await db.updateOrderStatus(orderId, 'label_created', {
      tracking_number: label.trackingNumber,
      label_url: label.labelUrl,
    });

    // Send confirmation email to customer (fire-and-forget)
    const { sendOrderConfirmation } = require('../services/email');
    sendOrderConfirmation({
      customerEmail: order.customers?.email,
      customerName: order.customers?.name,
      orderId,
      items: order.order_items || [],
      totalCents: order.total_offer_cents,
      labelUrl: label.labelUrl,
      trackingNumber: label.trackingNumber,
    }).catch(err => console.error('[email] Order confirmation failed:', err.message));

    res.json({
      orderId,
      trackingNumber: label.trackingNumber,
      labelUrl: label.labelUrl,
      trackingUrl: label.trackingUrl,
      service: label.service,
      cost: label.cost,
    });
  } catch (err) {
    console.error('Label generation error:', err.message);
    res.status(500).json({ error: 'Failed to generate label: ' + err.message });
  }
});

module.exports = router;

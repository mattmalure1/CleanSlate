const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const db = require('../services/supabase');

// GET /api/account/profile — get the logged-in customer's profile
router.get('/api/account/profile', requireAuth, async (req, res) => {
  try {
    if (!db.supabase) {
      return res.status(503).json({ error: 'Database not configured' });
    }

    const { data: customer } = await db.supabase
      .from('customers')
      .select('*')
      .eq('auth_id', req.authUser.id)
      .limit(1)
      .single();

    if (!customer) {
      return res.status(404).json({ error: 'Customer profile not found' });
    }

    res.json({ customer });
  } catch (err) {
    console.error('Profile fetch error:', err.message);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// PUT /api/account/profile — update the logged-in customer's profile
router.put('/api/account/profile', requireAuth, async (req, res) => {
  try {
    if (!db.supabase) {
      return res.status(503).json({ error: 'Database not configured' });
    }

    const { name, address, payoutMethod, payoutDetails } = req.body;

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (address !== undefined) updates.address = address;
    if (payoutMethod !== undefined) updates.payout_method = payoutMethod;
    if (payoutDetails !== undefined) updates.payout_details = payoutDetails;

    const { data: customer, error } = await db.supabase
      .from('customers')
      .update(updates)
      .eq('auth_id', req.authUser.id)
      .select()
      .single();

    if (error) throw new Error('Failed to update profile: ' + error.message);
    if (!customer) return res.status(404).json({ error: 'Customer profile not found' });

    res.json({ customer });
  } catch (err) {
    console.error('Profile update error:', err.message);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// GET /api/account/orders — list the logged-in customer's orders
router.get('/api/account/orders', requireAuth, async (req, res) => {
  try {
    if (!db.supabase) {
      return res.status(503).json({ error: 'Database not configured' });
    }

    // First find the customer ID for this auth user
    const { data: customer } = await db.supabase
      .from('customers')
      .select('id')
      .eq('auth_id', req.authUser.id)
      .limit(1)
      .single();

    if (!customer) {
      return res.json({ orders: [] });
    }

    // Fetch their orders with items
    const { data: orders, error } = await db.supabase
      .from('orders')
      .select(`
        id, status, total_offer_cents, tracking_number, label_url,
        created_at, notes,
        order_items (title, offered_price_cents, category)
      `)
      .eq('customer_id', customer.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw new Error('Failed to fetch orders: ' + error.message);

    // Add item_count for the summary view
    const enriched = (orders || []).map(o => ({
      ...o,
      item_count: o.order_items?.length || 0,
      items: o.order_items,
    }));

    res.json({ orders: enriched });
  } catch (err) {
    console.error('Account orders error:', err.message);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const db = require('../services/supabase');

// POST /api/auth/link-account — link Supabase Auth user to customers table
// Called on first login: finds existing customer by email or creates new one
router.post('/api/auth/link-account', requireAuth, async (req, res) => {
  try {
    const authUser = req.authUser;
    const authId = authUser.id;
    const email = authUser.email;
    const name = authUser.user_metadata?.name || '';

    if (!db.supabase) {
      return res.status(503).json({ error: 'Database not configured' });
    }

    // Check if already linked
    const { data: existing } = await db.supabase
      .from('customers')
      .select('*')
      .eq('auth_id', authId)
      .limit(1)
      .single();

    if (existing) {
      return res.json({ customer: existing, linked: false });
    }

    // Try to find a guest customer with the same email (no auth_id yet)
    const { data: guestCustomer } = await db.supabase
      .from('customers')
      .select('*')
      .eq('email', email)
      .is('auth_id', null)
      .limit(1)
      .single();

    if (guestCustomer) {
      // Link existing guest customer to this auth user
      const { data: updated, error } = await db.supabase
        .from('customers')
        .update({ auth_id: authId, name: name || guestCustomer.name })
        .eq('id', guestCustomer.id)
        .select()
        .single();

      if (error) throw new Error('Failed to link account: ' + error.message);
      return res.json({ customer: updated, linked: true, previousOrders: true });
    }

    // No existing customer — create a new one
    const { data: newCustomer, error } = await db.supabase
      .from('customers')
      .insert({
        name,
        email,
        auth_id: authId,
        payout_method: 'paypal',
        payout_details: '',
      })
      .select()
      .single();

    if (error) throw new Error('Failed to create customer: ' + error.message);
    return res.json({ customer: newCustomer, linked: true, previousOrders: false });
  } catch (err) {
    console.error('Link account error:', err.message);
    res.status(500).json({ error: 'Failed to link account' });
  }
});

module.exports = router;

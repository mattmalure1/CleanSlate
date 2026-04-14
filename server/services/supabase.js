const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn('Supabase not configured — orders will not persist');
}

const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey)
  : null;

// Create or find a customer by email
async function upsertCustomer({ name, email, address, payoutMethod, payoutDetails }) {
  if (!supabase) return null;

  // Check if customer exists
  const { data: existing } = await supabase
    .from('customers')
    .select('id')
    .eq('email', email)
    .limit(1)
    .single();

  if (existing) {
    // Update their info
    const { data } = await supabase
      .from('customers')
      .update({ name, address, payout_method: payoutMethod, payout_details: payoutDetails })
      .eq('id', existing.id)
      .select('id')
      .single();
    return data?.id || existing.id;
  }

  // Create new customer
  const { data, error } = await supabase
    .from('customers')
    .insert({ name, email, address, payout_method: payoutMethod, payout_details: payoutDetails })
    .select('id')
    .single();

  if (error) throw new Error('Failed to create customer: ' + error.message);
  return data.id;
}

// Create an order with items
async function createOrder({ customerId, items, totalOfferCents }) {
  if (!supabase) return null;

  // Create the order
  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .insert({
      customer_id: customerId,
      status: 'pending',
      total_offer_cents: totalOfferCents,
    })
    .select('id')
    .single();

  if (orderErr) throw new Error('Failed to create order: ' + orderErr.message);

  // Insert order items
  const orderItems = items.map(item => ({
    order_id: order.id,
    asin: item.asin,
    title: item.title,
    category: item.category || null,
    offered_price_cents: item.offerCents,
    has_case: item.hasCase ?? true,
  }));

  const { error: itemsErr } = await supabase
    .from('order_items')
    .insert(orderItems);

  if (itemsErr) throw new Error('Failed to save order items: ' + itemsErr.message);

  return order.id;
}

// Get an order by ID
async function getOrder(orderId) {
  if (!supabase) return null;

  const { data: order, error } = await supabase
    .from('orders')
    .select(`
      *,
      customers (*),
      order_items (*)
    `)
    .eq('id', orderId)
    .single();

  if (error) return null;
  return order;
}

// Update order status
async function updateOrderStatus(orderId, status, extras = {}) {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('orders')
    .update({ status, ...extras })
    .eq('id', orderId)
    .select()
    .single();

  if (error) throw new Error('Failed to update order: ' + error.message);
  return data;
}

// List recent orders
async function listOrders({ limit = 20, status = null } = {}) {
  if (!supabase) return [];

  let query = supabase
    .from('orders')
    .select(`
      *,
      customers (name, email),
      order_items (title, offered_price_cents, category)
    `)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) return [];
  return data;
}

// ── SKU Generation ──────────────────────────────────────────────
const CATEGORY_LETTERS = { book: 'B', dvd: 'D', cd: 'C', game: 'G' };

async function generateSku(category) {
  if (!supabase) return `CS-X0000-0000`;
  const letter = CATEGORY_LETTERS[category] || 'X';
  const now = new Date();
  const prefix = letter + String(now.getFullYear()).slice(2) + String(now.getMonth() + 1).padStart(2, '0');
  const { data, error } = await supabase.rpc('next_sku', { p_prefix: prefix });
  if (error) throw new Error('SKU generation failed: ' + error.message);
  return data;
}

// ── Inventory Functions ─────────────────────────────────────────

async function bulkCreateInventory(orderId) {
  if (!supabase) return [];

  const { data: items, error } = await supabase
    .from('order_items')
    .select('*')
    .eq('order_id', orderId);

  if (error) throw new Error('Failed to fetch order items: ' + error.message);
  if (!items || items.length === 0) return [];

  const inventoryRows = [];
  for (const item of items) {
    const sku = await generateSku(item.category);
    inventoryRows.push({
      sku,
      order_id: orderId,
      asin: item.asin,
      title: item.title,
      category: item.category || null,
      condition_received: item.condition || 'good',
      cost_cents: item.offered_price_cents || 0,
      status: 'received',
      received_at: new Date().toISOString(),
    });
  }

  const { data: created, error: insertErr } = await supabase
    .from('inventory')
    .insert(inventoryRows)
    .select();

  if (insertErr) throw new Error('Failed to create inventory: ' + insertErr.message);
  return created;
}

async function listInventory({ status, category, search, limit = 100, offset = 0 } = {}) {
  if (!supabase) return [];

  let query = supabase
    .from('inventory')
    .select('*')
    .order('received_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) query = query.eq('status', status);
  if (category) query = query.eq('category', category);
  if (search) {
    query = query.or(`sku.ilike.%${search}%,asin.ilike.%${search}%,title.ilike.%${search}%`);
  }

  const { data, error } = await query;
  if (error) throw new Error('Failed to list inventory: ' + error.message);
  return data || [];
}

async function getInventoryStats() {
  if (!supabase) return {};

  const { data: items, error } = await supabase
    .from('inventory')
    .select('status, cost_cents, expected_profit_cents, received_at');

  if (error) throw new Error('Failed to get inventory stats: ' + error.message);
  if (!items) return {};

  const stats = {
    byStatus: {},
    totalCostCents: 0,
    totalExpectedProfitCents: 0,
    aging: { over30: 0, over60: 0, over90: 0 },
  };

  const now = Date.now();
  const DAY_MS = 86400000;
  const nonTerminal = new Set(['received', 'grading', 'graded', 'listed', 'shipped']);

  for (const item of items) {
    stats.byStatus[item.status] = (stats.byStatus[item.status] || 0) + 1;
    stats.totalCostCents += item.cost_cents || 0;
    stats.totalExpectedProfitCents += item.expected_profit_cents || 0;

    if (nonTerminal.has(item.status) && item.received_at) {
      const ageDays = Math.floor((now - new Date(item.received_at).getTime()) / DAY_MS);
      if (ageDays > 90) stats.aging.over90++;
      else if (ageDays > 60) stats.aging.over60++;
      else if (ageDays > 30) stats.aging.over30++;
    }
  }

  stats.totalItems = items.length;
  return stats;
}

async function updateInventoryItem(sku, updates) {
  if (!supabase) return null;

  // Auto-set timestamps based on status changes
  if (updates.status === 'grading') {
    updates.graded_at = null;
  } else if (updates.status === 'graded') {
    updates.graded_at = new Date().toISOString();
  } else if (updates.status === 'listed') {
    updates.listed_at = new Date().toISOString();
  } else if (updates.status === 'sold') {
    updates.sold_at = new Date().toISOString();
  }

  // Compute expected profit when both sell_price_cents and cost_cents are present
  if (updates.sell_price_cents != null && updates.cost_cents != null) {
    const sellPrice = updates.sell_price_cents;
    const referral = Math.round(sellPrice * 0.15);
    const closing = 180;
    const fbaFee = updates.fba_fee_cents || 0;
    const prep = 145;
    const inboundShip = updates.inbound_ship_cents || 0;
    const cost = updates.cost_cents;
    updates.expected_profit_cents = sellPrice - referral - closing - fbaFee - prep - inboundShip - cost;
  }

  const { data, error } = await supabase
    .from('inventory')
    .update(updates)
    .eq('sku', sku)
    .select()
    .single();

  if (error) throw new Error('Failed to update inventory item: ' + error.message);
  return data;
}

async function batchUpdateInventoryStatus(skus, status) {
  if (!supabase) return [];

  const updates = { status };
  if (status === 'grading') updates.graded_at = null;
  else if (status === 'graded') updates.graded_at = new Date().toISOString();
  else if (status === 'listed') updates.listed_at = new Date().toISOString();
  else if (status === 'sold') updates.sold_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('inventory')
    .update(updates)
    .in('sku', skus)
    .select();

  if (error) throw new Error('Batch update failed: ' + error.message);
  return data || [];
}

// ── Quote Log Functions ─────────────────────────────────────────

async function logQuote(data) {
  if (!supabase) return null;

  const { data: row, error } = await supabase
    .from('quote_log')
    .insert({
      barcode: data.barcode || null,
      asin: data.asin || null,
      title: data.title || null,
      category: data.category || null,
      condition: data.condition || null,
      has_case: data.hasCase ?? true,
      sell_price_cents: data.sellPriceCents || null,
      offer_cents: data.offerCents || 0,
      status: data.status || 'quoted',
      quote_color: data.quoteColor || null,
      pricing_mode: data.pricingMode || 'buyback',
      session_id: data.sessionId || null,
    })
    .select()
    .single();

  if (error) throw new Error('Failed to log quote: ' + error.message);
  return row;
}

async function listQuoteLogs({ search, category, status, limit = 100, offset = 0 } = {}) {
  if (!supabase) return [];

  let query = supabase
    .from('quote_log')
    .select('*')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) query = query.eq('status', status);
  if (category) query = query.eq('category', category);
  if (search) {
    query = query.or(`barcode.ilike.%${search}%,asin.ilike.%${search}%,title.ilike.%${search}%`);
  }

  const { data, error } = await query;
  if (error) throw new Error('Failed to list quote logs: ' + error.message);
  return data || [];
}

// Log a quote_items row (spec §1.2) — the full calculation_trace audit record.
// Accepts the output of runOfferEngine() plus upc and optional quote_id.
// Fire-and-forget; errors are logged but not thrown so quote requests don't fail.
async function logQuoteItem({ upc, quoteId, offerOutput }) {
  if (!supabase) return null;
  if (!offerOutput || !offerOutput.calculation_trace) return null;

  const trace = offerOutput.calculation_trace;
  const row = {
    quote_id: quoteId || null,
    upc,
    asin: trace.asin || null,
    category: trace.category || null,
    title: trace.keepa_fields?.title || null,
    offer_cents: offerOutput.offer_cents ?? null,
    accepted: !!offerOutput.accepted,
    rejection_reason: offerOutput.rejection_reason || null,
    rejection_step: trace.rejection_step ?? null,
    tier: offerOutput.tier || null,
    keepa_data_timestamp: offerOutput.keepa_data_timestamp || new Date(),
    calculation_trace: trace,
  };

  const { data, error } = await supabase
    .from('quote_items')
    .insert(row)
    .select('id')
    .single();

  if (error) {
    console.error('[supabase] logQuoteItem failed:', error.message);
    return null;
  }
  return data?.id || null;
}

async function getQuoteStats() {
  if (!supabase) return {};

  const { data: quotes, error } = await supabase
    .from('quote_log')
    .select('status, category, offer_cents');

  if (error) throw new Error('Failed to get quote stats: ' + error.message);
  if (!quotes) return {};

  const stats = {
    total: quotes.length,
    byStatus: {},
    byCategory: {},
    averageOfferCents: 0,
    conversionRate: 0,
  };

  let totalOfferCents = 0;
  let converted = 0;

  for (const q of quotes) {
    stats.byStatus[q.status] = (stats.byStatus[q.status] || 0) + 1;
    if (q.category) stats.byCategory[q.category] = (stats.byCategory[q.category] || 0) + 1;
    totalOfferCents += q.offer_cents || 0;
    if (q.status === 'accepted' || q.status === 'ordered') converted++;
  }

  stats.averageOfferCents = quotes.length > 0 ? Math.round(totalOfferCents / quotes.length) : 0;
  stats.conversionRate = quotes.length > 0 ? Math.round((converted / quotes.length) * 10000) / 100 : 0;

  return stats;
}

module.exports = {
  supabase, upsertCustomer, createOrder, getOrder, updateOrderStatus, listOrders,
  generateSku, bulkCreateInventory, listInventory, getInventoryStats,
  updateInventoryItem, batchUpdateInventoryStatus,
  logQuote, logQuoteItem, listQuoteLogs, getQuoteStats,
};

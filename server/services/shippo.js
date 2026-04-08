const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const fetch = require('node-fetch');

const SHIPPO_API_KEY = process.env.SHIPPO_API_KEY;
const SHIPPO_BASE = 'https://api.goshippo.com';

// Your warehouse address (where customers ship TO)
const WAREHOUSE = {
  name: process.env.WAREHOUSE_NAME || 'CleanSlate Media',
  street1: process.env.WAREHOUSE_STREET || '123 Main Street',
  city: process.env.WAREHOUSE_CITY || 'Austin',
  state: process.env.WAREHOUSE_STATE || 'TX',
  zip: process.env.WAREHOUSE_ZIP || '78701',
  country: process.env.WAREHOUSE_COUNTRY || 'US',
  email: process.env.WAREHOUSE_EMAIL || '',
};

async function shippoRequest(endpoint, method = 'GET', body = null) {
  const res = await fetch(`${SHIPPO_BASE}${endpoint}`, {
    method,
    headers: {
      'Authorization': `ShippoToken ${SHIPPO_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : null,
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Shippo error ${res.status}: ${JSON.stringify(data)}`);
  }
  return data;
}

// Create a shipping label for a customer sending items to us
// Customer is the SENDER, we are the RECEIVER
async function createLabel({ customer, weightLbs }) {
  if (!SHIPPO_API_KEY) throw new Error('Shippo API key not configured');

  // 1. Create the shipment
  const shipment = await shippoRequest('/shipments', 'POST', {
    address_from: {
      name: customer.name,
      street1: customer.address.street,
      city: customer.address.city,
      state: customer.address.state,
      zip: customer.address.zip,
      country: 'US',
      email: customer.email || 'noreply@cleanslate.com',
      phone: customer.phone || '5551234567',
    },
    address_to: WAREHOUSE,
    parcels: [{
      length: '12',
      width: '10',
      height: '6',
      distance_unit: 'in',
      weight: String(Math.max(1, Math.round(weightLbs * 10) / 10)),
      mass_unit: 'lb',
    }],
    async: false,
  });

  // 2. Find the USPS Media Mail rate
  const rates = shipment.rates || [];
  const mediaMailRate = rates.find(r =>
    r.provider === 'USPS' &&
    r.servicelevel?.token?.toLowerCase().includes('media')
  );

  // Fallback: cheapest USPS rate if Media Mail not found
  const uspsRates = rates.filter(r => r.provider === 'USPS');
  uspsRates.sort((a, b) => parseFloat(a.amount) - parseFloat(b.amount));
  const selectedRate = mediaMailRate || uspsRates[0];

  if (!selectedRate) {
    throw new Error('No USPS rates available for this shipment');
  }

  // 3. Purchase the label
  const transaction = await shippoRequest('/transactions', 'POST', {
    rate: selectedRate.object_id,
    label_file_type: 'PDF',
    async: false,
  });

  if (transaction.status !== 'SUCCESS') {
    throw new Error(`Label creation failed: ${JSON.stringify(transaction.messages)}`);
  }

  return {
    trackingNumber: transaction.tracking_number,
    labelUrl: transaction.label_url,
    trackingUrl: transaction.tracking_url_provider,
    carrier: selectedRate.provider,
    service: selectedRate.servicelevel?.name || 'Media Mail',
    cost: selectedRate.amount,
    currency: selectedRate.currency,
  };
}

module.exports = { createLabel };

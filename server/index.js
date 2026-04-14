const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const quoteRoutes = require('./routes/quote');
const orderRoutes = require('./routes/order');
const adminRoutes = require('./routes/admin');
const inventoryRoutes = require('./routes/inventory');
const quoteLogRoutes = require('./routes/quoteLog');
const tierThresholds = require('./services/tierThresholds');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: [
    'http://localhost:5173',
    'https://mattmalure1.github.io',
    'https://cleanslatebuys.com',
    'https://www.cleanslatebuys.com',
  ]
}));
app.use(helmet());
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use(quoteRoutes);
app.use(orderRoutes);
app.use(adminRoutes);
app.use(inventoryRoutes);
app.use(quoteLogRoutes);

// Start server — fail-fast on missing engine config.
// The engine reads tier_thresholds + offer_engine_config at runtime; an empty
// table would produce garbage offers silently, so we load-and-verify at boot.
(async () => {
  try {
    await tierThresholds.loadThresholds();
  } catch (err) {
    console.error('FATAL: engine config failed to load at startup.');
    console.error(err.message);
    console.error('Did you run migration 2026-04-10_engine_spec_alignment.sql?');
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`CleanSlate server running on port ${PORT}`);
  });
})();

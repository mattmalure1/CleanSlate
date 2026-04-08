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

// Start server
app.listen(PORT, () => {
  console.log(`CleanSlate server running on port ${PORT}`);
});

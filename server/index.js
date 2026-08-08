const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const memberRoutes = require('./routes/members');
const chitRoutes = require('./routes/chits');
const auctionRoutes = require('./routes/auctions');
const paymentRoutes = require('./routes/payments');
const dividendRoutes = require('./routes/dividends');
const reportRoutes = require('./routes/reports');
const auditRoutes = require('./routes/audit');

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS & JSON parsing
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Register API Endpoints
app.use('/api/auth', authRoutes);
app.use('/api/members', memberRoutes);
app.use('/api/chits', chitRoutes);
app.use('/api/auctions', auctionRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/dividends', dividendRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/audit', auditRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    company: 'BALAJI SAVINGS & FINANCE',
    timestamp: new Date().toISOString()
  });
});

// Centralized Error Handling Middleware
app.use((err, req, res, next) => {
  console.error('Unhandled API Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'An unexpected internal server error occurred.'
  });
});

// Start Server
app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`BALAJI SAVINGS & FINANCE - Server Running on Port ${PORT}`);
  console.log(`REST API Ready at http://localhost:${PORT}/api`);
  console.log(`=======================================================`);
});

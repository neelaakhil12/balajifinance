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

// Serve frontend static assets if in production Vercel monorepo
const clientDistPath = path.join(__dirname, '../client/dist');
app.use(express.static(clientDistPath));

// Fallback for React SPA Routing
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(clientDistPath, 'index.html'), (err) => {
    if (err) next();
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

// Start Server if run directly
if (require.main === module || !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`BALAJI SAVINGS & FINANCE - Server Running on Port ${PORT}`);
    console.log(`REST API Ready at http://localhost:${PORT}/api`);
    console.log(`=======================================================`);
  });
}

module.exports = app;

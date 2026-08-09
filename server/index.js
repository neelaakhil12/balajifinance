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

// Enable CORS & Body Parsing (Safe for both Standalone Node & Vercel Serverless Functions)
app.use(cors());

// Vercel Serverless Body Parser Guard (prevents 500 error when stream is already consumed by Vercel)
app.use((req, res, next) => {
  if (req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0) {
    return next();
  }
  express.json({ limit: '10mb' })(req, res, (err) => {
    if (err) return next();
    next();
  });
});

app.use((req, res, next) => {
  if (req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0) {
    return next();
  }
  express.urlencoded({ extended: true })(req, res, (err) => {
    if (err) return next();
    next();
  });
});

// Register API Endpoints (Supports both /api/* and /* paths on Vercel)
app.use(['/api/auth', '/auth'], authRoutes);
app.use(['/api/members', '/members'], memberRoutes);
app.use(['/api/chits', '/chits'], chitRoutes);
app.use(['/api/auctions', '/auctions'], auctionRoutes);
app.use(['/api/payments', '/payments'], paymentRoutes);
app.use(['/api/dividends', '/dividends'], dividendRoutes);
app.use(['/api/reports', '/reports'], reportRoutes);
app.use(['/api/audit', '/audit'], auditRoutes);

// Health check endpoint
app.get(['/api/health', '/health'], (req, res) => {
  res.json({
    status: 'healthy',
    company: 'BALAJI SAVINGS & FINANCE',
    timestamp: new Date().toISOString()
  });
});

// Serve frontend static assets ONLY when running standalone (not inside Vercel Serverless Function)
if (!process.env.VERCEL) {
  const clientDistPath = path.join(__dirname, '../client/dist');
  app.use(express.static(clientDistPath));

  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(clientDistPath, 'index.html'), (err) => {
      if (err) next();
    });
  });
}

// Fallback 404 JSON for unmatched API routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `API endpoint ${req.originalUrl || req.url} not found.`
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
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`=======================================================`);
    console.log(`BALAJI SAVINGS & FINANCE - Server Running on Port ${PORT}`);
    console.log(`REST API Ready at http://localhost:${PORT}/api`);
    console.log(`=======================================================`);
  });
}

module.exports = app;

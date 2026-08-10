const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();
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

const db = require('./db/database');

// Ensure database is 100% synchronized from Supabase Cloud DB on Vercel Serverless Functions
app.use(async (req, res, next) => {
  if (db && typeof db.syncFromSupabase === 'function') {
    try {
      await db.syncFromSupabase();
    } catch (e) {
      console.warn('Vercel DB sync warning:', e.message);
    }
  }
  next();
});

function getRoute(routeName) {
  const routePath = require.resolve(`./routes/${routeName}`);
  if (process.env.NODE_ENV !== 'production') {
    delete require.cache[routePath];
  }
  return require(`./routes/${routeName}`);
}

// Register API Endpoints (Supports both /api/* and /* paths on Vercel)
app.use(['/api/auth', '/auth'], (req, res, next) => getRoute('auth')(req, res, next));
app.use(['/api/members', '/members'], (req, res, next) => getRoute('members')(req, res, next));
app.use(['/api/chits', '/chits'], (req, res, next) => getRoute('chits')(req, res, next));
app.use(['/api/auctions', '/auctions'], (req, res, next) => getRoute('auctions')(req, res, next));
app.use(['/api/payments', '/payments'], (req, res, next) => getRoute('payments')(req, res, next));
app.use(['/api/dividends', '/dividends'], (req, res, next) => getRoute('dividends')(req, res, next));
app.use(['/api/reports', '/reports'], (req, res, next) => getRoute('reports')(req, res, next));
app.use(['/api/audit', '/audit'], (req, res, next) => getRoute('audit')(req, res, next));

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

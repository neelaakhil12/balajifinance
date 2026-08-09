let app;
try {
  app = require('../server/index.js');
} catch (err) {
  console.error('Failed to load server app on Vercel:', err);
}

module.exports = (req, res) => {
  if (!app) {
    return res.status(500).json({
      success: false,
      message: 'Server failed to initialize on Vercel. Please check server logs.'
    });
  }
  return app(req, res);
};

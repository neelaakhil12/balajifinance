let app;
let initError = null;

try {
  app = require('../server/index.js');
} catch (err) {
  initError = err;
  console.error('Failed to load server app on Vercel:', err);
}

module.exports = (req, res) => {
  if (!app) {
    return res.status(500).json({
      success: false,
      message: `Server failed to initialize on Vercel: ${initError ? initError.message : 'Unknown initialization error'}`
    });
  }
  return app(req, res);
};

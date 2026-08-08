const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { authenticateToken } = require('../middleware/auth');

// GET /api/audit (list system audit logs)
router.get('/', authenticateToken, (req, res) => {
  try {
    const { limit = 50 } = req.query;
    const limitNum = parseInt(limit, 10);
    const logs = db.prepare('SELECT * FROM audit_logs ORDER BY id DESC LIMIT ?').all(limitNum);
    return res.json({ success: true, logs });
  } catch (error) {
    console.error('Fetch audit logs error:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve audit log records.' });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../db/database');
const { generateToken, authenticateToken } = require('../middleware/auth');
const { logAuditAction } = require('../utils/auditLogger');

// POST /api/auth/login
router.post('/login', (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email address and password are required.' });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(cleanEmail);

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email address or password.' });
    }

    const isMatch = bcrypt.compareSync(String(password), user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email address or password.' });
    }

    const token = generateToken(user);

    try {
      logAuditAction(user.id, user.name, 'USER_LOGIN', 'Auth', `User ${user.email} logged in successfully.`);
    } catch (e) {
      // Audit log error shouldn't block login
    }

    return res.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login API error:', error);
    return res.status(500).json({
      success: false,
      message: `Login error: ${error.message || String(error)}`
    });
  }
});

// GET /api/auth/me
router.get('/me', authenticateToken, (req, res) => {
  try {
    const user = db.prepare('SELECT id, name, email, role, created_at FROM users WHERE id = ?').get(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    return res.json({ success: true, user });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Failed to retrieve user session.' });
  }
});

// POST /api/auth/logout
router.post('/logout', authenticateToken, (req, res) => {
  try {
    logAuditAction(req.user.id, req.user.name, 'USER_LOGOUT', 'Auth', `User logged out.`);
  } catch (e) {}
  return res.json({ success: true, message: 'Logged out successfully.' });
});

module.exports = router;

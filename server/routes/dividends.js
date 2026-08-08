const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { authenticateToken } = require('../middleware/auth');

// GET /api/dividends (list dividends with filtering by scheme, member, month)
router.get('/', authenticateToken, (req, res) => {
  try {
    const { scheme_id, member_id, month_number } = req.query;

    let query = `
      SELECT d.*, cs.scheme_name, cs.scheme_code, m.name as member_name, m.member_code, a.winning_bid_discount, a.foreman_commission, a.dividend_pool
      FROM dividends d
      JOIN chit_schemes cs ON d.scheme_id = cs.id
      JOIN members m ON d.member_id = m.id
      JOIN auctions a ON d.auction_id = a.id
      WHERE 1=1
    `;
    const params = [];

    if (scheme_id) {
      query += ' AND d.scheme_id = ?';
      params.push(scheme_id);
    }

    if (member_id) {
      query += ' AND d.member_id = ?';
      params.push(member_id);
    }

    if (month_number) {
      query += ' AND d.month_number = ?';
      params.push(month_number);
    }

    query += ' ORDER BY d.month_number DESC, m.name ASC';

    const dividends = db.prepare(query).all(...params);

    // Summary statistics
    const totalDividendDistributed = dividends.reduce((acc, curr) => acc + curr.dividend_amount, 0);

    return res.json({
      success: true,
      dividends,
      summary: {
        totalDividendDistributed
      }
    });
  } catch (error) {
    console.error('Fetch dividends error:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve dividend records.' });
  }
});

module.exports = router;

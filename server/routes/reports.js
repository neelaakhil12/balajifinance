const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { authenticateToken } = require('../middleware/auth');
const { maskAadhaar } = require('../utils/financials');

// GET /api/reports/dashboard (Dashboard aggregate numbers, recent activity & charts)
router.get('/dashboard', authenticateToken, (req, res) => {
  try {
    // 1. Summary Cards
    const totalMembers = (db.prepare("SELECT COUNT(*) as cnt FROM members WHERE chit_status != 'Deactivated'").get() || {}).cnt || 0;
    const activeChitSchemes = (db.prepare("SELECT COUNT(*) as cnt FROM chit_schemes WHERE status = 'Active'").get() || {}).cnt || 0;
    const completedChits = (db.prepare("SELECT COUNT(*) as cnt FROM chit_schemes WHERE status = 'Completed'").get() || {}).cnt || 0;
    
    const totalChitValueRow = db.prepare("SELECT SUM(total_chit_value) as total FROM chit_schemes WHERE status = 'Active'").get() || {};
    const totalChitValue = totalChitValueRow.total || 0;

    const collectionRow = db.prepare("SELECT SUM(amount_paid) as total FROM monthly_payments").get() || {};
    const currentMonthCollection = collectionRow.total || 0;

    const dividendRow = db.prepare("SELECT SUM(dividend_amount) as total FROM dividends").get() || {};
    const currentMonthDividend = dividendRow.total || 0;

    const pendingRow = db.prepare("SELECT SUM(net_amount_due - amount_paid) as total FROM monthly_payments WHERE status IN ('Pending', 'Partially Paid', 'Overdue')").get() || {};
    const pendingPayments = pendingRow.total || 0;

    // 2. Recent Members
    const recentMembers = (db.prepare("SELECT * FROM members ORDER BY id DESC LIMIT 5").all() || []).map(m => ({
      ...m,
      masked_aadhaar: maskAadhaar(m.aadhaar_no)
    }));

    // 3. Active Chit Schemes
    const activeSchemes = (db.prepare("SELECT * FROM chit_schemes WHERE status = 'Active' ORDER BY id DESC LIMIT 5").all() || []).map(sch => {
      const enrolledCount = (db.prepare('SELECT COUNT(*) as cnt FROM chit_enrollments WHERE scheme_id = ?').get(sch.id) || {}).cnt || 0;
      return { ...sch, enrolled_members_count: enrolledCount };
    });

    // 4. Recent Auctions
    const recentAuctions = db.prepare(`
      SELECT a.*, cs.scheme_name, m.name as winner_name
      FROM auctions a
      JOIN chit_schemes cs ON a.scheme_id = cs.id
      JOIN members m ON a.winning_member_id = m.id
      ORDER BY a.id DESC LIMIT 5
    `).all() || [];

    // 5. Recent Activity (Audit logs)
    const recentActivity = db.prepare("SELECT * FROM audit_logs ORDER BY id DESC LIMIT 6").all() || [];

    // 6. Chart Datasets
    // Monthly collections breakdown (Grouped by month_number)
    const collectionsChart = db.prepare(`
      SELECT month_number, SUM(amount_paid) as collected, SUM(net_amount_due) as target
      FROM monthly_payments
      GROUP BY month_number
      ORDER BY month_number ASC
    `).all() || [];

    // Monthly dividends breakdown
    const dividendsChart = db.prepare(`
      SELECT month_number, SUM(dividend_amount) as total_dividend
      FROM dividends
      GROUP BY month_number
      ORDER BY month_number ASC
    `).all() || [];

    // Active vs Completed Chits
    const chitsStatusChart = [
      { name: 'Active Schemes', value: activeChitSchemes },
      { name: 'Completed Schemes', value: completedChits },
      { name: 'Upcoming Schemes', value: (db.prepare("SELECT COUNT(*) as cnt FROM chit_schemes WHERE status = 'Upcoming'").get() || {}).cnt || 0 }
    ];

    return res.json({
      success: true,
      summary: {
        totalMembers,
        activeChitSchemes,
        totalChitValue,
        currentMonthCollection,
        currentMonthDividend,
        pendingPayments,
        completedChits
      },
      recentMembers,
      activeSchemes,
      recentAuctions,
      recentActivity,
      charts: {
        collectionsChart,
        dividendsChart,
        chitsStatusChart
      }
    });
  } catch (error) {
    console.error('Dashboard reports error:', error);
    return res.status(500).json({ success: false, message: 'Failed to generate dashboard metrics.' });
  }
});

// GET /api/reports/member-report
router.get('/member-report', authenticateToken, (req, res) => {
  try {
    const { status, search } = req.query;
    let query = 'SELECT * FROM members WHERE 1=1';
    const params = [];

    if (status) {
      query += ' AND chit_status = ?';
      params.push(status);
    }
    if (search) {
      const s = `%${search}%`;
      query += ' AND (name LIKE ? OR email LIKE ? OR contact_no_1 LIKE ?)';
      params.push(s, s, s);
    }

    const members = db.prepare(query).all(...params).map(m => ({
      ...m,
      masked_aadhaar: maskAadhaar(m.aadhaar_no)
    }));

    return res.json({ success: true, data: members });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch member report.' });
  }
});

// GET /api/reports/chit-report
router.get('/chit-report', authenticateToken, (req, res) => {
  try {
    const { status } = req.query;
    let query = 'SELECT * FROM chit_schemes WHERE 1=1';
    const params = [];

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    const schemes = db.prepare(query).all(...params).map(sch => {
      const enrolled = db.prepare('SELECT COUNT(*) as cnt FROM chit_enrollments WHERE scheme_id = ?').get(sch.id).cnt;
      return { ...sch, enrolled_members: enrolled };
    });

    return res.json({ success: true, data: schemes });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch chit scheme report.' });
  }
});

// GET /api/reports/collection-report
router.get('/collection-report', authenticateToken, (req, res) => {
  try {
    const { scheme_id, month_number } = req.query;
    let query = `
      SELECT mp.*, cs.scheme_name, m.name as member_name, m.member_code
      FROM monthly_payments mp
      JOIN chit_schemes cs ON mp.scheme_id = cs.id
      JOIN members m ON mp.member_id = m.id
      WHERE 1=1
    `;
    const params = [];

    if (scheme_id) {
      query += ' AND mp.scheme_id = ?';
      params.push(scheme_id);
    }
    if (month_number) {
      query += ' AND mp.month_number = ?';
      params.push(month_number);
    }

    query += ' ORDER BY mp.month_number ASC';

    const payments = db.prepare(query).all(...params);
    return res.json({ success: true, data: payments });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch collection report.' });
  }
});

// GET /api/reports/auction-report
router.get('/auction-report', authenticateToken, (req, res) => {
  try {
    const { scheme_id } = req.query;
    let query = `
      SELECT a.*, cs.scheme_name, m.name as winner_name
      FROM auctions a
      JOIN chit_schemes cs ON a.scheme_id = cs.id
      JOIN members m ON a.winning_member_id = m.id
      WHERE 1=1
    `;
    const params = [];
    if (scheme_id) {
      query += ' AND a.scheme_id = ?';
      params.push(scheme_id);
    }
    query += ' ORDER BY a.month_number ASC';
    const data = db.prepare(query).all(...params);
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch auction report.' });
  }
});

// GET /api/reports/dividend-report
router.get('/dividend-report', authenticateToken, (req, res) => {
  try {
    const { scheme_id, member_id } = req.query;
    let query = `
      SELECT d.*, cs.scheme_name, m.name as member_name, m.member_code
      FROM dividends d
      JOIN chit_schemes cs ON d.scheme_id = cs.id
      JOIN members m ON d.member_id = m.id
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
    const data = db.prepare(query).all(...params);
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch dividend report.' });
  }
});

// GET /api/reports/pending-payments-report
router.get('/pending-payments-report', authenticateToken, (req, res) => {
  try {
    const { scheme_id } = req.query;
    let query = `
      SELECT mp.*, cs.scheme_name, m.name as member_name, m.member_code, m.contact_no_1, (mp.net_amount_due - mp.amount_paid) as pending_balance
      FROM monthly_payments mp
      JOIN chit_schemes cs ON mp.scheme_id = cs.id
      JOIN members m ON mp.member_id = m.id
      WHERE mp.status IN ('Pending', 'Partially Paid', 'Overdue')
    `;
    const params = [];
    if (scheme_id) {
      query += ' AND mp.scheme_id = ?';
      params.push(scheme_id);
    }
    query += ' ORDER BY pending_balance DESC';
    const data = db.prepare(query).all(...params);
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch pending payments report.' });
  }
});

module.exports = router;

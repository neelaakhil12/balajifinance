const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { authenticateToken } = require('../middleware/auth');
const { calculateAuctionFinancials } = require('../utils/financials');
const { logAuditAction } = require('../utils/auditLogger');

// GET /api/auctions (list all auctions with filtering by scheme)
router.get('/', authenticateToken, (req, res) => {
  try {
    const { scheme_id } = req.query;

    let query = `
      SELECT a.*, cs.scheme_name, cs.scheme_code, cs.total_chit_value, cs.monthly_contribution, m.name as winner_name, m.member_code as winner_code
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

    query += ' ORDER BY a.id DESC';

    const auctions = db.prepare(query).all(...params);

    return res.json({ success: true, auctions });
  } catch (error) {
    console.error('Fetch auctions error:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve auction records.' });
  }
});

// POST /api/auctions/calculate (Preview dynamic financial calculation)
router.post('/calculate', authenticateToken, (req, res) => {
  try {
    const { scheme_id, auction_discount } = req.body;

    if (!scheme_id || auction_discount === undefined || auction_discount === null) {
      return res.status(400).json({ success: false, message: 'Scheme ID and auction discount are required.' });
    }

    const scheme = db.prepare('SELECT * FROM chit_schemes WHERE id = ?').get(scheme_id);
    if (!scheme) {
      return res.status(404).json({ success: false, message: 'Chit scheme not found.' });
    }

    const calculations = calculateAuctionFinancials({
      totalChitValue: scheme.total_chit_value,
      auctionDiscount: auction_discount,
      foremanCommissionPercent: scheme.foreman_commission_percent,
      foremanCommissionAmount: scheme.foreman_commission_amount,
      numberOfMembers: scheme.number_of_members,
      monthlyContribution: scheme.monthly_contribution
    });

    return res.json({
      success: true,
      scheme: {
        id: scheme.id,
        scheme_name: scheme.scheme_name,
        scheme_code: scheme.scheme_code
      },
      calculations
    });
  } catch (error) {
    console.error('Calculate auction error:', error);
    return res.status(500).json({ success: false, message: 'Failed to perform auction calculation.' });
  }
});

// POST /api/auctions (Conduct and record monthly auction)
router.post('/', authenticateToken, (req, res) => {
  try {
    const {
      scheme_id,
      month_number,
      auction_date,
      winning_member_id,
      winning_bid_discount,
      notes
    } = req.body;

    if (!scheme_id || !month_number || !winning_member_id || winning_bid_discount === undefined) {
      return res.status(400).json({ success: false, message: 'All required auction fields must be provided.' });
    }

    const scheme = db.prepare('SELECT * FROM chit_schemes WHERE id = ?').get(scheme_id);
    if (!scheme) {
      return res.status(404).json({ success: false, message: 'Selected chit scheme does not exist.' });
    }

    const monthNum = parseInt(month_number, 10);
    if (monthNum < 1 || monthNum > scheme.duration_months) {
      return res.status(400).json({ success: false, message: `Auction month must be between 1 and ${scheme.duration_months}.` });
    }

    // Check if auction for this month already exists
    const existingAuction = db.prepare('SELECT id FROM auctions WHERE scheme_id = ? AND month_number = ?').get(scheme_id, monthNum);
    if (existingAuction) {
      return res.status(400).json({ success: false, message: `Month ${monthNum} auction has already been recorded for this scheme.` });
    }

    // Verify member is enrolled in this scheme
    const enrollment = db.prepare('SELECT id FROM chit_enrollments WHERE scheme_id = ? AND member_id = ?').get(scheme_id, winning_member_id);
    if (!enrollment) {
      return res.status(400).json({ success: false, message: 'Winning member is not enrolled in this chit scheme.' });
    }

    // Check if member has already won a previous auction in this scheme
    const previousWin = db.prepare('SELECT id, month_number FROM auctions WHERE scheme_id = ? AND winning_member_id = ?').get(scheme_id, winning_member_id);
    if (previousWin) {
      return res.status(400).json({ success: false, message: `This member has already won Month ${previousWin.month_number} auction in this scheme.` });
    }

    // Perform server-side financial calculations
    const enrolledMembersCount = db.prepare('SELECT COUNT(*) as cnt FROM chit_enrollments WHERE scheme_id = ?').get(scheme_id).cnt;
    const calcMembersCount = enrolledMembersCount > 0 ? enrolledMembersCount : scheme.number_of_members;

    const calc = calculateAuctionFinancials({
      totalChitValue: scheme.total_chit_value,
      auctionDiscount: winning_bid_discount,
      foremanCommissionPercent: scheme.foreman_commission_percent,
      foremanCommissionAmount: scheme.foreman_commission_amount,
      numberOfMembers: calcMembersCount,
      monthlyContribution: scheme.monthly_contribution
    });

    const now = new Date().toISOString();
    const aucDateVal = auction_date || new Date().toISOString().split('T')[0];

    // Transaction to insert auction, dividends, and monthly payment dues atomically
    const insertTransaction = db.transaction(() => {
      // 1. Insert Auction
      const aucStmt = db.prepare(`
        INSERT INTO auctions (
          scheme_id, month_number, auction_date, winning_member_id,
          winning_bid_discount, foreman_commission, winner_payout,
          dividend_pool, dividend_per_member, next_month_payable, notes, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const aucResult = aucStmt.run(
        scheme_id,
        monthNum,
        aucDateVal,
        winning_member_id,
        calc.auctionDiscount,
        calc.foremanCommission,
        calc.winnerPayout,
        calc.netDividendPool,
        calc.dividendPerMember,
        calc.nextMonthPayable,
        notes || '',
        now
      );

      const auctionId = aucResult.lastInsertRowid;

      // 2. Fetch all enrolled members for dividend & payment records
      const enrolledMembers = db.prepare('SELECT member_id FROM chit_enrollments WHERE scheme_id = ?').all(scheme_id);

      const insertDividendStmt = db.prepare(`
        INSERT INTO dividends (auction_id, scheme_id, member_id, month_number, dividend_amount, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      const upsertPaymentStmt = db.prepare(`
        INSERT INTO monthly_payments (scheme_id, member_id, month_number, base_contribution, dividend_applied, net_amount_due, amount_paid, status, notes, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 0, 'Pending', ?, ?)
        ON CONFLICT(scheme_id, member_id, month_number) DO UPDATE SET
          dividend_applied = excluded.dividend_applied,
          net_amount_due = excluded.net_amount_due
      `);

      enrolledMembers.forEach(m => {
        // Record dividend
        insertDividendStmt.run(auctionId, scheme_id, m.member_id, monthNum, calc.dividendPerMember, now);

        // Record or update payment due for this month
        upsertPaymentStmt.run(
          scheme_id,
          m.member_id,
          monthNum,
          scheme.monthly_contribution,
          calc.dividendPerMember,
          calc.nextMonthPayable,
          `Auto-created from Month ${monthNum} Auction Dividend`,
          now
        );
      });

      return { auctionId, resultCalc: calc };
    });

    const { auctionId, resultCalc } = insertTransaction();

    logAuditAction(
      req.user.id,
      req.user.name,
      'CONDUCT_AUCTION',
      'Auctions',
      `Recorded Month ${monthNum} Auction for Scheme ID ${scheme_id}. Winner ID: ${winning_member_id}, Payout: ₹${resultCalc.winnerPayout}, Dividend/Member: ₹${resultCalc.dividendPerMember}.`
    );

    return res.status(201).json({
      success: true,
      message: `Month ${monthNum} Auction recorded successfully. Dividend of ₹${resultCalc.dividendPerMember} distributed to ${calcMembersCount} members.`,
      auctionId,
      calculations: resultCalc
    });
  } catch (error) {
    console.error('Record auction error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to record auction.' });
  }
});

module.exports = router;

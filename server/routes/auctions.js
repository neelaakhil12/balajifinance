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
      SELECT a.*, cs.scheme_name, cs.scheme_code, cs.total_chit_value, cs.monthly_contribution, cs.number_of_members, cs.foreman_commission_percent, cs.foreman_commission_amount, m.name as winner_name, m.member_code as winner_code
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

    const rawAuctions = db.prepare(query).all(...params);

    const auctions = rawAuctions.map(a => {
      const calc = calculateAuctionFinancials({
        totalChitValue: a.total_chit_value,
        auctionDiscount: a.winning_bid_discount,
        foremanCommissionPercent: a.foreman_commission_percent,
        foremanCommissionAmount: a.foreman_commission_amount,
        numberOfMembers: a.number_of_members,
        monthlyContribution: a.monthly_contribution
      });

      // Update stored record in DB if outdated
      try {
        db.prepare('UPDATE auctions SET dividend_per_member = ?, next_month_payable = ? WHERE id = ?')
          .run(calc.dividendPerMember, calc.nextMonthPayable, a.id);
      } catch (e) {}

      return {
        ...a,
        foreman_commission: calc.foremanCommission,
        winner_payout: calc.winnerPayout,
        dividend_pool: calc.netDividendPool,
        dividend_per_member: calc.dividendPerMember,
        next_month_payable: calc.nextMonthPayable
      };
    });

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
      notes,
      payout_mode,
      payout_ref_no,
      payout_bank_name,
      payout_cheque_no,
      payout_cheque_date,
      payout_proof_image
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

    // Verify member is enrolled in this scheme (or auto-enroll if capacity allows)
    let enrollment = db.prepare('SELECT id FROM chit_enrollments WHERE scheme_id = ? AND member_id = ?').get(scheme_id, winning_member_id);
    if (!enrollment) {
      const currentEnrolledCount = db.prepare('SELECT COUNT(*) as cnt FROM chit_enrollments WHERE scheme_id = ?').get(scheme_id).cnt;
      if (currentEnrolledCount >= scheme.number_of_members) {
        return res.status(400).json({ success: false, message: 'This chit scheme has reached maximum member capacity.' });
      }
      const nextTicketNumber = currentEnrolledCount + 1;
      const nowStr = new Date().toISOString();
      db.prepare('INSERT INTO chit_enrollments (scheme_id, member_id, ticket_number, enrolled_at) VALUES (?, ?, ?, ?)').run(scheme_id, winning_member_id, nextTicketNumber, nowStr);
    }

    const winningTicketNo = req.body.winning_ticket_number ? parseInt(req.body.winning_ticket_number, 10) : 1;

    // Check if this MEMBER has already won any auction in this scheme
    // Rule: Each PERSON can only win ONCE per scheme, regardless of how many tickets they hold
    const previousWin = db.prepare('SELECT id, month_number FROM auctions WHERE scheme_id = ? AND winning_member_id = ?').get(scheme_id, winning_member_id);
    if (previousWin) {
      return res.status(400).json({ success: false, message: `This member has already won Month ${previousWin.month_number} auction in this scheme. Each member can only win once.` });
    }

    // Perform server-side financial calculations using full scheme membership capacity
    const calc = calculateAuctionFinancials({
      totalChitValue: scheme.total_chit_value,
      auctionDiscount: winning_bid_discount,
      foremanCommissionPercent: scheme.foreman_commission_percent,
      foremanCommissionAmount: scheme.foreman_commission_amount,
      numberOfMembers: scheme.number_of_members,
      monthlyContribution: scheme.monthly_contribution
    });

    const now = new Date().toISOString();
    const aucDateVal = auction_date || new Date().toISOString().split('T')[0];

    // Transaction to insert auction, dividends, and monthly payment dues atomically
    const insertTransaction = db.transaction(() => {
      // 1. Insert Auction
      const aucStmt = db.prepare(`
        INSERT INTO auctions (
          scheme_id, month_number, auction_date, winning_member_id, winning_ticket_number,
          winning_bid_discount, foreman_commission, winner_payout,
          dividend_pool, dividend_per_member, next_month_payable, notes, created_at,
          payout_mode, payout_ref_no, payout_bank_name, payout_cheque_no, payout_cheque_date, payout_proof_image
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const aucResult = aucStmt.run(
        scheme_id,
        monthNum,
        aucDateVal,
        winning_member_id,
        winningTicketNo,
        calc.auctionDiscount,
        calc.foremanCommission,
        calc.winnerPayout,
        calc.netDividendPool,
        calc.dividendPerMember,
        calc.nextMonthPayable,
        notes || '',
        now,
        payout_mode || 'Bank Transfer',
        payout_ref_no || null,
        payout_bank_name || null,
        payout_cheque_no || null,
        payout_cheque_date || null,
        payout_proof_image || null
      );

      const auctionId = aucResult.lastInsertRowid;

      // 2. Fetch all enrolled tickets for dividend & payment records
      const enrolledTickets = db.prepare('SELECT member_id, ticket_number FROM chit_enrollments WHERE scheme_id = ?').all(scheme_id);

      const insertDividendStmt = db.prepare(`
        INSERT INTO dividends (auction_id, scheme_id, member_id, ticket_number, month_number, dividend_amount, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      const upsertPaymentStmt = db.prepare(`
        INSERT INTO monthly_payments (scheme_id, member_id, ticket_number, month_number, base_contribution, dividend_applied, net_amount_due, amount_paid, status, notes, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 0, 'Pending', ?, ?)
        ON CONFLICT(scheme_id, member_id, ticket_number, month_number) DO UPDATE SET
          dividend_applied = excluded.dividend_applied,
          net_amount_due = excluded.net_amount_due
      `);

      enrolledTickets.forEach(m => {
        // Record dividend
        insertDividendStmt.run(auctionId, scheme_id, m.member_id, m.ticket_number, monthNum, calc.dividendPerMember, now);

        // Record or update payment due for this month per ticket
        upsertPaymentStmt.run(
          scheme_id,
          m.member_id,
          m.ticket_number,
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
      message: `Month ${monthNum} Auction recorded successfully. Dividend of ₹${resultCalc.dividendPerMember} distributed to ${scheme.number_of_members} members.`,
      auctionId,
      calculations: resultCalc
    });
  } catch (error) {
    console.error('Record auction error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to record auction.' });
  }
});

// PUT /api/auctions/:id (Edit auction record & update financials)
router.put('/:id', authenticateToken, (req, res) => {
  try {
    const auctionId = req.params.id;
    const { winning_member_id, winning_ticket_number, winning_bid_discount, auction_date, notes } = req.body;

    const auction = db.prepare('SELECT * FROM auctions WHERE id = ?').get(auctionId);
    if (!auction) {
      return res.status(404).json({ success: false, message: 'Auction record not found.' });
    }

    const scheme = db.prepare('SELECT * FROM chit_schemes WHERE id = ?').get(auction.scheme_id);
    if (!scheme) {
      return res.status(404).json({ success: false, message: 'Associated chit scheme not found.' });
    }

    const newDiscount = winning_bid_discount !== undefined ? Number(winning_bid_discount) : auction.winning_bid_discount;
    const newWinnerId = winning_member_id ? Number(winning_member_id) : auction.winning_member_id;
    const newTicketNo = winning_ticket_number ? Number(winning_ticket_number) : (auction.winning_ticket_number || 1);
    const newDate = auction_date || auction.auction_date;

    const calc = calculateAuctionFinancials({
      totalChitValue: scheme.total_chit_value,
      auctionDiscount: newDiscount,
      foremanCommissionPercent: scheme.foreman_commission_percent,
      foremanCommissionAmount: scheme.foreman_commission_amount,
      numberOfMembers: scheme.number_of_members,
      monthlyContribution: scheme.monthly_contribution
    });

    const updateTransaction = db.transaction(() => {
      // 1. Update Auctions table
      db.prepare(`
        UPDATE auctions
        SET winning_member_id = ?, winning_ticket_number = ?, winning_bid_discount = ?,
            foreman_commission = ?, winner_payout = ?, dividend_pool = ?,
            dividend_per_member = ?, next_month_payable = ?, auction_date = ?, notes = ?
        WHERE id = ?
      `).run(
        newWinnerId,
        newTicketNo,
        newDiscount,
        calc.foremanCommission,
        calc.winnerPayout,
        calc.netDividendPool,
        calc.dividendPerMember,
        calc.nextMonthPayable,
        newDate,
        notes !== undefined ? notes : (auction.notes || ''),
        auctionId
      );

      // 2. Update Dividends table
      db.prepare('UPDATE dividends SET dividend_amount = ? WHERE auction_id = ?').run(calc.dividendPerMember, auctionId);

      // 3. Update Monthly Payments table
      db.prepare(`
        UPDATE monthly_payments
        SET dividend_applied = ?, net_amount_due = ?
        WHERE scheme_id = ? AND month_number = ?
      `).run(calc.dividendPerMember, calc.nextMonthPayable, auction.scheme_id, auction.month_number);
    });

    updateTransaction();

    logAuditAction(
      req.user.id,
      req.user.name,
      'EDIT_AUCTION',
      'Auctions',
      `Updated Auction ID ${auctionId} (Month ${auction.month_number}). New discount: ₹${newDiscount}, New Winner Payout: ₹${calc.winnerPayout}.`
    );

    return res.json({
      success: true,
      message: `Auction for Month ${auction.month_number} updated successfully.`,
      calculations: calc
    });
  } catch (error) {
    console.error('Edit auction error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update auction record.' });
  }
});

// DELETE /api/auctions/:id (Delete auction record & revert payments)
router.delete('/:id', authenticateToken, (req, res) => {
  try {
    const auctionId = req.params.id;
    const auction = db.prepare('SELECT * FROM auctions WHERE id = ?').get(auctionId);

    if (!auction) {
      return res.status(404).json({ success: false, message: 'Auction record not found.' });
    }

    const deleteTransaction = db.transaction(() => {
      // 1. Delete associated Dividends
      db.prepare('DELETE FROM dividends WHERE auction_id = ?').run(auctionId);

      // 2. Delete generated Monthly Payment dues for this month
      db.prepare('DELETE FROM monthly_payments WHERE scheme_id = ? AND month_number = ?').run(auction.scheme_id, auction.month_number);

      // 3. Delete Auction record
      db.prepare('DELETE FROM auctions WHERE id = ?').run(auctionId);
    });

    deleteTransaction();

    logAuditAction(
      req.user.id,
      req.user.name,
      'DELETE_AUCTION',
      'Auctions',
      `Deleted Auction ID ${auctionId} (Month ${auction.month_number}) for Scheme ID ${auction.scheme_id}.`
    );

    return res.json({
      success: true,
      message: `Auction for Month ${auction.month_number} deleted successfully. Member is now eligible to bid again.`
    });
  } catch (error) {
    console.error('Delete auction error:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete auction record.' });
  }
});

module.exports = router;

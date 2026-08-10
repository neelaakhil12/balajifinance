const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { authenticateToken } = require('../middleware/auth');
const { roundToTwoDecimals } = require('../utils/financials');
const { logAuditAction } = require('../utils/auditLogger');

// GET /api/chits (list all schemes with metrics)
router.get('/', authenticateToken, (req, res) => {
  try {
    const { status, search } = req.query;

    let query = 'SELECT * FROM chit_schemes WHERE 1=1';
    const params = [];

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    if (search) {
      const s = `%${search.trim()}%`;
      query += ' AND (scheme_name LIKE ? OR scheme_code LIKE ?)';
      params.push(s, s);
    }

    query += ' ORDER BY id DESC';

    const schemes = db.prepare(query).all(...params) || [];

    // Enhance each scheme with enrolled members count and completed auctions count
    const enhancedSchemes = schemes.map(sch => {
      const enrolledCount = (db.prepare('SELECT COUNT(*) as cnt FROM chit_enrollments WHERE scheme_id = ?').get(sch.id) || {}).cnt || 0;
      const completedAuctionsCount = (db.prepare('SELECT COUNT(*) as cnt FROM auctions WHERE scheme_id = ?').get(sch.id) || {}).cnt || 0;
      return {
        ...sch,
        enrolled_members_count: enrolledCount,
        completed_auctions_count: completedAuctionsCount
      };
    });

    return res.json({ success: true, schemes: enhancedSchemes });
  } catch (error) {
    console.error('Fetch chit schemes error:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve chit schemes.' });
  }
});

// POST /api/chits (Create new Chit Scheme)
router.post('/', authenticateToken, (req, res) => {
  try {
    const {
      scheme_name,
      total_chit_value,
      duration_months,
      number_of_members,
      monthly_contribution,
      foreman_commission_percent = 5,
      start_date,
      end_date
    } = req.body;

    if (!scheme_name || !total_chit_value || !duration_months || !number_of_members) {
      return res.status(400).json({ success: false, message: 'Required chit scheme parameters are missing.' });
    }

    const chitVal = roundToTwoDecimals(total_chit_value);
    const duration = parseInt(duration_months, 10);
    const membersCount = parseInt(number_of_members, 10);
    const commPercent = parseFloat(foreman_commission_percent) || 5;

    // Derived monthly contribution if not supplied
    const calcMonthly = monthly_contribution
      ? roundToTwoDecimals(monthly_contribution)
      : roundToTwoDecimals(chitVal / duration);

    const commAmount = roundToTwoDecimals((chitVal * commPercent) / 100);

    const now = new Date().toISOString();
    const maxId = (db.prepare('SELECT MAX(id) as max_id FROM chit_schemes').get() || {}).max_id || 0;
    const schemeCode = `BSF-SCH-${1001 + maxId}`;

    const startDateVal = start_date || new Date().toISOString().split('T')[0];
    const endDateVal = end_date || new Date(Date.now() + duration * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const result = db.prepare(`
      INSERT INTO chit_schemes (scheme_code, scheme_name, total_chit_value, duration_months, number_of_members, monthly_contribution, foreman_commission_percent, foreman_commission_amount, start_date, end_date, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active', ?)
    `).run(
      schemeCode,
      scheme_name.trim(),
      chitVal,
      duration,
      membersCount,
      calcMonthly,
      commPercent,
      commAmount,
      startDateVal,
      endDateVal,
      now
    );

    logAuditAction(req.user.id, req.user.name, 'CREATE_CHIT_SCHEME', 'Chit Schemes', `Created scheme ${schemeCode} (${scheme_name}) with value ₹${chitVal}`);

    return res.status(201).json({
      success: true,
      message: 'Chit scheme created successfully.',
      schemeId: result.lastInsertRowid,
      schemeCode
    });
  } catch (error) {
    console.error('Create chit scheme error:', error);
    return res.status(500).json({ success: false, message: 'Failed to create chit scheme.' });
  }
});

// GET /api/chits/:id (Scheme Details + Enrolled Members with Payment Stats + Auctions History)
router.get('/:id', authenticateToken, (req, res) => {
  try {
    const schemeId = req.params.id;
    let scheme = db.prepare('SELECT * FROM chit_schemes WHERE id = ?').get(schemeId);
    if (!scheme) {
      scheme = db.prepare('SELECT * FROM chit_schemes WHERE scheme_code = ?').get(schemeId);
    }

    if (!scheme) {
      return res.status(404).json({ success: false, message: 'Chit scheme not found.' });
    }

    // Enrolled members
    const rawEnrolledMembers = db.prepare(`
      SELECT ce.id as enrollment_id, ce.ticket_number, ce.enrolled_at, m.id as member_id, m.member_code, m.name, m.email, m.contact_no_1, m.aadhaar_no, m.kyc_status
      FROM chit_enrollments ce
      JOIN members m ON ce.member_id = m.id
      WHERE ce.scheme_id = ?
      ORDER BY ce.ticket_number ASC
    `).all(schemeId) || [];

    // Auctions history
    const auctions = db.prepare(`
      SELECT a.*, m.name as winner_name, m.member_code as winner_code
      FROM auctions a
      JOIN members m ON a.winning_member_id = m.id
      WHERE a.scheme_id = ?
      ORDER BY a.month_number ASC
    `).all(schemeId) || [];

    // Enrich enrolled members with real-time payment stats
    const enrolledMembers = rawEnrolledMembers.map(m => {
      const pmtRecords = db.prepare(`
        SELECT * FROM monthly_payments
        WHERE scheme_id = ? AND member_id = ? AND (ticket_number = ? OR ticket_number IS NULL OR ticket_number = 1)
      `).all(schemeId, m.member_id, m.ticket_number || 1) || [];

      let paidMonths = 0;
      let totalAmountPaid = 0;
      let dueMonths = 0;
      let totalAmountDue = 0;

      pmtRecords.forEach(p => {
        if (p.status === 'Paid') {
          paidMonths++;
          totalAmountPaid += (p.amount_paid || 0);
        } else if (p.status === 'Partially Paid') {
          totalAmountPaid += (p.amount_paid || 0);
          dueMonths++;
          totalAmountDue += Math.max(0, (p.net_amount_due || 0) - (p.amount_paid || 0));
        } else if (p.status === 'Pending' || p.status === 'Overdue') {
          dueMonths++;
          totalAmountDue += (p.net_amount_due || 0);
        }
      });

      const auctionWin = (auctions || []).find(a => a && Number(a.winning_member_id) === Number(m.member_id) && (Number(a.winning_ticket_number || 1) === Number(m.ticket_number || 1)));

      return {
        ...m,
        duration_months: scheme.duration_months,
        paid_months_count: paidMonths,
        remaining_months_count: Math.max(0, scheme.duration_months - paidMonths),
        total_amount_paid: totalAmountPaid,
        due_months_count: dueMonths,
        total_amount_due: totalAmountDue,
        monthly_base_payable: scheme.monthly_contribution,
        auction_win: auctionWin ? {
          month_number: auctionWin.month_number,
          winner_payout: auctionWin.winner_payout,
          winning_bid_discount: auctionWin.winning_bid_discount
        } : null
      };
    });

    return res.json({
      success: true,
      scheme,
      enrolledMembers,
      auctions
    });
  } catch (error) {
    console.error('Fetch scheme details error:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve scheme details.' });
  }
});

// POST /api/chits/:id/enroll (Enroll Member into Scheme)
router.post('/:id/enroll', authenticateToken, (req, res) => {
  try {
    const schemeId = req.params.id;
    const { member_id, ticket_number } = req.body;

    if (!member_id) {
      return res.status(400).json({ success: false, message: 'Member selection is required for enrollment.' });
    }

    let scheme = db.prepare('SELECT * FROM chit_schemes WHERE id = ?').get(schemeId);
    if (!scheme) {
      scheme = db.prepare('SELECT * FROM chit_schemes WHERE scheme_code = ?').get(schemeId);
    }
    if (!scheme) {
      return res.status(404).json({ success: false, message: 'Chit scheme not found.' });
    }
    const realSchemeId = scheme.id;

    // Check existing enrollments count
    const currentEnrolled = (db.prepare('SELECT COUNT(*) as cnt FROM chit_enrollments WHERE scheme_id = ?').get(realSchemeId) || {}).cnt || 0;
    if (currentEnrolled >= scheme.number_of_members) {
      return res.status(400).json({ success: false, message: 'This chit scheme has reached maximum member capacity.' });
    }

    // Determine ticket number
    let ticketNo = ticket_number ? parseInt(ticket_number, 10) : (currentEnrolled + 1);

    // Verify ticket number uniqueness
    const ticketTaken = db.prepare('SELECT id FROM chit_enrollments WHERE scheme_id = ? AND ticket_number = ?').get(realSchemeId, ticketNo);
    if (ticketTaken) {
      return res.status(400).json({ success: false, message: `Ticket number #${ticketNo} is already assigned to another member.` });
    }

    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO chit_enrollments (scheme_id, member_id, ticket_number, enrolled_at, status)
      VALUES (?, ?, ?, ?, 'Active')
    `).run(realSchemeId, member_id, ticketNo, now);

    logAuditAction(req.user.id, req.user.name, 'ENROLL_MEMBER', 'Chit Schemes', `Enrolled member ID ${member_id} to scheme ${scheme.scheme_code} on ticket #${ticketNo}.`);

    return res.json({ success: true, message: `Member successfully enrolled with ticket #${ticketNo}.` });
  } catch (error) {
    console.error('Enroll member error:', error);
    return res.status(500).json({ success: false, message: 'Failed to enroll member in chit scheme.' });
  }
});

// DELETE /api/chits/:id/enroll/:enrollmentId (Unenroll member)
router.delete('/:id/enroll/:enrollmentId', authenticateToken, (req, res) => {
  try {
    const { id, enrollmentId } = req.params;
    db.prepare('DELETE FROM chit_enrollments WHERE id = ? AND scheme_id = ?').run(enrollmentId, id);

    logAuditAction(req.user.id, req.user.name, 'UNENROLL_MEMBER', 'Chit Schemes', `Unenrolled enrollment ID ${enrollmentId} from scheme ID ${id}.`);

    return res.json({ success: true, message: 'Member removed from scheme successfully.' });
  } catch (error) {
    console.error('Unenroll error:', error);
    return res.status(500).json({ success: false, message: 'Failed to unenroll member.' });
  }
});

// DELETE /api/chits/:id (Delete Chit Scheme and associated data)
router.delete('/:id', authenticateToken, (req, res) => {
  try {
    const schemeId = req.params.id;
    const scheme = db.prepare('SELECT * FROM chit_schemes WHERE id = ?').get(schemeId);

    if (!scheme) {
      return res.status(404).json({ success: false, message: 'Chit scheme not found.' });
    }

    // Delete associated enrollments, auctions, monthly_payments, dividends
    db.prepare('DELETE FROM chit_enrollments WHERE scheme_id = ?').run(schemeId);
    db.prepare('DELETE FROM auctions WHERE scheme_id = ?').run(schemeId);
    db.prepare('DELETE FROM monthly_payments WHERE scheme_id = ?').run(schemeId);
    db.prepare('DELETE FROM dividends WHERE scheme_id = ?').run(schemeId);

    // Delete chit scheme
    db.prepare('DELETE FROM chit_schemes WHERE id = ?').run(schemeId);

    logAuditAction(req.user.id, req.user.name, 'DELETE_CHIT_SCHEME', 'Chit Schemes', `Deleted chit scheme ${scheme.scheme_code} (${scheme.scheme_name}).`);

    return res.json({ success: true, message: `Chit scheme ${scheme.scheme_code} deleted successfully.` });
  } catch (error) {
    console.error('Delete chit scheme error:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete chit scheme.' });
  }
});

module.exports = router;

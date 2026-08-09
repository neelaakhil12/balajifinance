const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { authenticateToken } = require('../middleware/auth');
const { logAuditAction } = require('../utils/auditLogger');
const { roundToTwoDecimals } = require('../utils/financials');

// GET /api/payments (list monthly payments with filters)
router.get('/', authenticateToken, (req, res) => {
  try {
    const { scheme_id, month_number, member_id, status, search } = req.query;

    let query = `
      SELECT mp.*, cs.scheme_name, cs.scheme_code, m.name as member_name, m.member_code, m.contact_no_1
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

    if (member_id) {
      query += ' AND mp.member_id = ?';
      params.push(member_id);
    }

    if (status) {
      query += ' AND mp.status = ?';
      params.push(status);
    }

    if (search) {
      const s = `%${search.trim()}%`;
      query += ' AND (m.name LIKE ? OR m.member_code LIKE ? OR mp.reference_no LIKE ?)';
      params.push(s, s, s);
    }

    query += ' ORDER BY mp.month_number DESC, m.name ASC';

    const payments = db.prepare(query).all(...params);

    return res.json({ success: true, payments });
  } catch (error) {
    console.error('Fetch payments error:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve monthly payment records.' });
  }
});

// POST /api/payments/record (Record or update payment for a member)
router.post('/record', authenticateToken, (req, res) => {
  try {
    const {
      payment_id,
      scheme_id,
      member_id,
      month_number,
      amount_paid,
      payment_date,
      payment_mode = 'UPI',
      reference_no,
      notes,
      proof_image_data,
      bank_name,
      cheque_no,
      cheque_date
    } = req.body;

    if (amount_paid === undefined || amount_paid === null) {
      return res.status(400).json({ success: false, message: 'Payment amount is required.' });
    }

    const paidVal = roundToTwoDecimals(amount_paid);
    const payDate = payment_date || new Date().toISOString().split('T')[0];

    let targetPayment = null;

    if (payment_id) {
      targetPayment = db.prepare('SELECT * FROM monthly_payments WHERE id = ?').get(payment_id);
    } else if (scheme_id && member_id && month_number) {
      targetPayment = db.prepare('SELECT * FROM monthly_payments WHERE scheme_id = ? AND member_id = ? AND month_number = ?').get(scheme_id, member_id, month_number);
    }

    if (!targetPayment) {
      return res.status(404).json({ success: false, message: 'Monthly payment record not found.' });
    }

    // Determine new status
    let newStatus = 'Pending';
    if (paidVal >= targetPayment.net_amount_due) {
      newStatus = 'Paid';
    } else if (paidVal > 0) {
      newStatus = 'Partially Paid';
    }

    db.prepare(`
      UPDATE monthly_payments
      SET amount_paid = ?, payment_date = ?, payment_mode = ?, reference_no = ?, status = ?, notes = ?, proof_image_data = ?, bank_name = ?, cheque_no = ?, cheque_date = ?
      WHERE id = ?
    `).run(
      paidVal,
      payDate,
      payment_mode,
      reference_no ? reference_no.trim() : null,
      newStatus,
      notes || targetPayment.notes || '',
      proof_image_data || targetPayment.proof_image_data || null,
      bank_name || targetPayment.bank_name || null,
      cheque_no || targetPayment.cheque_no || null,
      cheque_date || targetPayment.cheque_date || null,
      targetPayment.id
    );

    logAuditAction(
      req.user.id,
      req.user.name,
      'RECORD_PAYMENT',
      'Monthly Payments',
      `Recorded payment of ₹${paidVal} for Payment ID ${targetPayment.id}. Status set to ${newStatus}.`
    );

    return res.json({
      success: true,
      message: `Payment of ₹${paidVal} successfully recorded. Status: ${newStatus}`,
      paymentId: targetPayment.id,
      newStatus
    });
  } catch (error) {
    console.error('Record payment error:', error);
    return res.status(500).json({ success: false, message: 'Failed to record payment.' });
  }
});

module.exports = router;

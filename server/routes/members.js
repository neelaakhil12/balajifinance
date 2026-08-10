const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const db = require('../db/database');
const { authenticateToken } = require('../middleware/auth');
const { maskAadhaar } = require('../utils/financials');
const { logAuditAction } = require('../utils/auditLogger');

// Force memory storage on Vercel/serverless environments to avoid read-only file system errors
const isServerless = Boolean(
  process.env.VERCEL ||
  process.env.AWS_LAMBDA_FUNCTION_NAME ||
  process.env.VERCEL_ENV
);

let storage;
if (isServerless) {
  storage = multer.memoryStorage();
} else {
  try {
    const uploadDir = path.join(__dirname, '..', 'uploads', 'kyc');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    storage = multer.diskStorage({
      destination: (req, file, cb) => cb(null, uploadDir),
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, file.fieldname + '-' + uniqueSuffix + ext);
      }
    });
  } catch (err) {
    storage = multer.memoryStorage();
  }
}

const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF, JPG, JPEG, and PNG files are allowed.'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// GET /api/members (list with search, filter, pagination)
router.get('/', authenticateToken, (req, res) => {
  try {
    const { search, kyc_status, chit_status, page = 1, limit = 10 } = req.query;
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const offset = (pageNum - 1) * limitNum;

    let query = 'SELECT * FROM members WHERE 1=1';
    const params = [];

    if (search) {
      const s = `%${search.trim()}%`;
      query += ' AND (name LIKE ? OR email LIKE ? OR contact_no_1 LIKE ? OR member_code LIKE ?)';
      params.push(s, s, s, s);
    }

    if (kyc_status) {
      query += ' AND kyc_status = ?';
      params.push(kyc_status);
    }

    if (chit_status) {
      query += ' AND chit_status = ?';
      params.push(chit_status);
    }

    // Count query
    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total');
    const totalCount = (db.prepare(countQuery).get(...params) || {}).total || 0;

    query += ' ORDER BY id DESC LIMIT ? OFFSET ?';
    params.push(limitNum, offset);

    const members = db.prepare(query).all(...params) || [];

    // Process masked aadhaar & scheme enrollments
    const processedMembers = members.map(m => {
      const enrollments = db.prepare(`
        SELECT ce.ticket_number, cs.id as scheme_id, cs.scheme_code, cs.scheme_name, cs.total_chit_value, cs.monthly_contribution
        FROM chit_enrollments ce
        JOIN chit_schemes cs ON ce.scheme_id = cs.id
        WHERE ce.member_id = ?
      `).all(m.id) || [];

      const uniqueSchemes = new Set(enrollments.map(e => e.scheme_id));

      return {
        ...m,
        masked_aadhaar: maskAadhaar(m.aadhaar_no),
        schemes_count: uniqueSchemes.size,
        tickets_count: enrollments.length,
        enrollments
      };
    });

    return res.json({
      success: true,
      members: processedMembers,
      pagination: {
        total: totalCount,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(totalCount / limitNum) || 1
      }
    });
  } catch (error) {
    console.error('Fetch members error:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve members list.' });
  }
});

// POST /api/members (Add member with KYC document uploads)
router.post(
  '/',
  authenticateToken,
  upload.fields([
    { name: 'aadhaar_document', maxCount: 1 },
    { name: 'pan_document', maxCount: 1 }
  ]),
  (req, res) => {
    try {
      const { name, email, contact_no_1, contact_no_2, aadhaar_id_no } = req.body;

      // Validation
      if (!name || !name.trim()) {
        return res.status(400).json({ success: false, message: 'Member full name is required.' });
      }
      if (!email || !email.trim() || !/\S+@\S+\.\S+/.test(email)) {
        return res.status(400).json({ success: false, message: 'A valid email address is required.' });
      }
      if (!contact_no_1 || !contact_no_1.trim()) {
        return res.status(400).json({ success: false, message: 'Primary contact number is required.' });
      }
      if (!aadhaar_id_no || !aadhaar_id_no.trim()) {
        return res.status(400).json({ success: false, message: 'Aadhaar ID number is required.' });
      }

      // Check duplicates
      const existingEmail = db.prepare('SELECT id FROM members WHERE email = ?').get(email.trim().toLowerCase());
      if (existingEmail) {
        return res.status(400).json({ success: false, message: 'A member with this email address already exists.' });
      }

      const existingAadhaar = db.prepare('SELECT id FROM members WHERE aadhaar_no = ?').get(aadhaar_id_no.trim());
      if (existingAadhaar) {
        return res.status(400).json({ success: false, message: 'A member with this Aadhaar number already exists.' });
      }

      // Verify files uploaded
      if (!req.files || !req.files.aadhaar_document || !req.files.pan_document) {
        return res.status(400).json({
          success: false,
          message: 'Both Aadhaar and PAN Card KYC documents must be uploaded.'
        });
      }

      const now = new Date().toISOString();

      // Generate Member Code: BSF-MBR-100X
      const maxId = (db.prepare('SELECT MAX(id) as max_id FROM members').get() || {}).max_id || 0;
      const memberCode = `BSF-MBR-${1001 + maxId}`;

      // Insert Member
      const result = db.prepare(`
        INSERT INTO members (member_code, name, email, contact_no_1, contact_no_2, aadhaar_no, kyc_status, chit_status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 'Verified', 'Active', ?, ?)
      `).run(
        memberCode,
        name.trim(),
        email.trim().toLowerCase(),
        contact_no_1.trim(),
        contact_no_2 ? contact_no_2.trim() : '',
        aadhaar_id_no.trim(),
        now,
        now
      );

      const memberId = result.lastInsertRowid;

      // Helper function to extract file data safely across diskStorage & memoryStorage
      const getFileData = (file) => {
        if (!file) return { filename: '', path: '', size: 0, mimetype: '' };
        const ext = path.extname(file.originalname || '') || '.pdf';
        const filename = file.filename || `${file.fieldname}-${Date.now()}-${Math.round(Math.random()*1E9)}${ext}`;
        let filePath = file.path;
        if (!filePath && file.buffer) {
          filePath = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
        }
        return {
          filename,
          originalname: file.originalname || 'document.pdf',
          path: filePath || filename,
          mimetype: file.mimetype || 'application/pdf',
          size: file.size || (file.buffer ? file.buffer.length : 0)
        };
      };

      // Save KYC document records
      const insertDocStmt = db.prepare(`
        INSERT INTO kyc_documents (member_id, document_type, file_name, original_name, file_path, mime_type, file_size, uploaded_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const aadhaarData = getFileData(req.files.aadhaar_document[0]);
      insertDocStmt.run(
        memberId,
        'aadhaar',
        aadhaarData.filename,
        aadhaarData.originalname,
        aadhaarData.path,
        aadhaarData.mimetype,
        aadhaarData.size,
        now
      );

      const panData = getFileData(req.files.pan_document[0]);
      insertDocStmt.run(
        memberId,
        'pan',
        panData.filename,
        panData.originalname,
        panData.path,
        panData.mimetype,
        panData.size,
        now
      );

      logAuditAction(req.user.id, req.user.name, 'CREATE_MEMBER', 'Members', `Created member ${memberCode} (${name.trim()}) with KYC documents.`);

      return res.status(201).json({
        success: true,
        message: 'Member registered successfully with verified KYC documents.',
        memberId,
        memberCode
      });
    } catch (error) {
      console.error('Create member error:', error);
      return res.status(500).json({ success: false, message: error.message || 'Failed to create member record.' });
    }
  }
);

// GET /api/members/:id (Member Profile & Details)
router.get('/:id', authenticateToken, (req, res) => {
  try {
    const memberId = req.params.id;
    const member = db.prepare('SELECT * FROM members WHERE id = ?').get(memberId);

    if (!member) {
      return res.status(404).json({ success: false, message: 'Member profile not found.' });
    }

    // Masked Aadhaar
    member.masked_aadhaar = maskAadhaar(member.aadhaar_no);

    // KYC Documents
    const kycDocs = db.prepare('SELECT id, document_type, original_name, mime_type, file_size, uploaded_at FROM kyc_documents WHERE member_id = ?').all(memberId);

    // Assigned Chit Schemes
    const chitSchemes = db.prepare(`
      SELECT cs.id, cs.scheme_code, cs.scheme_name, cs.total_chit_value, cs.duration_months, cs.monthly_contribution, ce.ticket_number, ce.status as enrollment_status
      FROM chit_enrollments ce
      JOIN chit_schemes cs ON ce.scheme_id = cs.id
      WHERE ce.member_id = ?
    `).all(memberId);

    // Payment History
    const payments = db.prepare(`
      SELECT mp.*, cs.scheme_name
      FROM monthly_payments mp
      JOIN chit_schemes cs ON mp.scheme_id = cs.id
      WHERE mp.member_id = ?
      ORDER BY mp.month_number ASC
    `).all(memberId);

    // Auction History (Wins)
    const auctionsWon = db.prepare(`
      SELECT a.*, cs.scheme_name
      FROM auctions a
      JOIN chit_schemes cs ON a.scheme_id = cs.id
      WHERE a.winning_member_id = ?
    `).all(memberId);

    // Dividend History
    const dividends = db.prepare(`
      SELECT d.*, cs.scheme_name
      FROM dividends d
      JOIN chit_schemes cs ON d.scheme_id = cs.id
      WHERE d.member_id = ?
      ORDER BY d.month_number ASC
    `).all(memberId);

    return res.json({
      success: true,
      member,
      kycDocs,
      chitSchemes,
      payments,
      auctionsWon,
      dividends
    });
  } catch (error) {
    console.error('Fetch member profile error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load member profile details.' });
  }
});

// GET /api/members/:id/documents/:docId (Protected document streaming)
router.get('/:id/documents/:docId', authenticateToken, (req, res) => {
  try {
    const { id, docId } = req.params;
    const doc = db.prepare('SELECT * FROM kyc_documents WHERE id = ? AND member_id = ?').get(docId, id);

    if (!doc) {
      return res.status(404).json({ success: false, message: 'KYC Document not found.' });
    }

    if (!fs.existsSync(doc.file_path)) {
      return res.status(404).json({ success: false, message: 'Document file missing on disk.' });
    }

    logAuditAction(req.user.id, req.user.name, 'VIEW_KYC_DOCUMENT', 'KYC', `Viewed ${doc.document_type} document for member ID ${id}.`);

    res.setHeader('Content-Type', doc.mime_type);
    res.setHeader('Content-Disposition', `inline; filename="${doc.original_name}"`);
    const fileStream = fs.createReadStream(doc.file_path);
    fileStream.pipe(res);
  } catch (error) {
    console.error('Stream document error:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve document.' });
  }
});

// PUT /api/members/:id (Edit member details)
router.put('/:id', authenticateToken, (req, res) => {
  try {
    const memberId = req.params.id;
    const { name, email, contact_no_1, contact_no_2, aadhaar_no, kyc_status, chit_status } = req.body;

    const existing = db.prepare('SELECT * FROM members WHERE id = ?').get(memberId);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Member not found.' });
    }

    const now = new Date().toISOString();

    db.prepare(`
      UPDATE members
      SET name = ?, email = ?, contact_no_1 = ?, contact_no_2 = ?, aadhaar_no = ?, kyc_status = ?, chit_status = ?, updated_at = ?
      WHERE id = ?
    `).run(
      name || existing.name,
      email || existing.email,
      contact_no_1 || existing.contact_no_1,
      contact_no_2 !== undefined ? contact_no_2 : existing.contact_no_2,
      aadhaar_no || existing.aadhaar_no,
      kyc_status || existing.kyc_status,
      chit_status || existing.chit_status,
      now,
      memberId
    );

    logAuditAction(req.user.id, req.user.name, 'UPDATE_MEMBER', 'Members', `Updated details for member ID ${memberId}.`);

    return res.json({ success: true, message: 'Member details updated successfully.' });
  } catch (error) {
    console.error('Update member error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update member details.' });
  }
});

// DELETE /api/members/:id (Permanently delete member record and all associated data)
router.delete('/:id', authenticateToken, (req, res) => {
  try {
    const memberId = req.params.id;
    const member = db.prepare('SELECT * FROM members WHERE id = ?').get(memberId);

    if (!member) {
      return res.status(404).json({ success: false, message: 'Member not found.' });
    }

    // Delete associated records from kyc_documents, chit_enrollments, monthly_payments, dividends
    db.prepare('DELETE FROM kyc_documents WHERE member_id = ?').run(memberId);
    db.prepare('DELETE FROM chit_enrollments WHERE member_id = ?').run(memberId);
    db.prepare('DELETE FROM monthly_payments WHERE member_id = ?').run(memberId);
    db.prepare('DELETE FROM dividends WHERE member_id = ?').run(memberId);

    // Delete member record permanently
    db.prepare('DELETE FROM members WHERE id = ?').run(memberId);

    logAuditAction(req.user.id, req.user.name, 'DELETE_MEMBER', 'Members', `Permanently deleted member ${member.member_code} (${member.name}).`);

    return res.json({ success: true, message: `Member ${member.name} permanently deleted successfully.` });
  } catch (error) {
    console.error('Delete member error:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete member record.' });
  }
});

module.exports = router;

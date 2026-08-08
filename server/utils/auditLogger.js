const db = require('../db/database');

function logAuditAction(userId, userName, action, target, details) {
  try {
    const stmt = db.prepare(`
      INSERT INTO audit_logs (user_id, user_name, action, target, details, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const detailsStr = typeof details === 'object' ? JSON.stringify(details) : String(details || '');
    stmt.run(userId || 1, userName || 'System Admin', action, target, detailsStr, new Date().toISOString());
  } catch (error) {
    console.error('Failed to log audit action:', error.message);
  }
}

module.exports = {
  logAuditAction
};

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

// Handle Vercel serverless read-only filesystem by storing DB in /tmp if deployed
const isVercel = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME;
const dbDir = isVercel ? '/tmp' : __dirname;
const dbPath = path.join(dbDir, 'balaji_chitfund.db');

const db = new Database(dbPath, { verbose: null });

db.pragma('foreign_keys = ON');

function initDB() {
  // 1. Users / Admin Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin',
      created_at TEXT NOT NULL
    );
  `);

  // 2. Members Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      member_code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      contact_no_1 TEXT NOT NULL,
      contact_no_2 TEXT,
      aadhaar_no TEXT NOT NULL,
      kyc_status TEXT NOT NULL DEFAULT 'Verified',
      chit_status TEXT NOT NULL DEFAULT 'Active',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  // 3. KYC Documents Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS kyc_documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      member_id INTEGER NOT NULL,
      document_type TEXT NOT NULL,
      file_name TEXT NOT NULL,
      original_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      uploaded_at TEXT NOT NULL,
      FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
    );
  `);

  // 4. Chit Schemes Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS chit_schemes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      scheme_code TEXT UNIQUE NOT NULL,
      scheme_name TEXT NOT NULL,
      total_chit_value REAL NOT NULL,
      duration_months INTEGER NOT NULL,
      number_of_members INTEGER NOT NULL,
      monthly_contribution REAL NOT NULL,
      foreman_commission_percent REAL NOT NULL DEFAULT 5.0,
      foreman_commission_amount REAL NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Active',
      created_at TEXT NOT NULL
    );
  `);

  // 5. Chit Enrollments Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS chit_enrollments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      scheme_id INTEGER NOT NULL,
      member_id INTEGER NOT NULL,
      ticket_number INTEGER NOT NULL,
      enrolled_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Active',
      FOREIGN KEY (scheme_id) REFERENCES chit_schemes(id) ON DELETE CASCADE,
      FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
      UNIQUE(scheme_id, ticket_number),
      UNIQUE(scheme_id, member_id)
    );
  `);

  // 6. Auctions Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS auctions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      scheme_id INTEGER NOT NULL,
      month_number INTEGER NOT NULL,
      auction_date TEXT NOT NULL,
      winning_member_id INTEGER NOT NULL,
      winning_bid_discount REAL NOT NULL,
      foreman_commission REAL NOT NULL,
      winner_payout REAL NOT NULL,
      dividend_pool REAL NOT NULL,
      dividend_per_member REAL NOT NULL,
      next_month_payable REAL NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (scheme_id) REFERENCES chit_schemes(id) ON DELETE CASCADE,
      FOREIGN KEY (winning_member_id) REFERENCES members(id) ON DELETE RESTRICT,
      UNIQUE(scheme_id, month_number)
    );
  `);

  // 7. Monthly Payments Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS monthly_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      scheme_id INTEGER NOT NULL,
      member_id INTEGER NOT NULL,
      month_number INTEGER NOT NULL,
      base_contribution REAL NOT NULL,
      dividend_applied REAL NOT NULL DEFAULT 0,
      net_amount_due REAL NOT NULL,
      amount_paid REAL NOT NULL DEFAULT 0,
      payment_date TEXT,
      payment_mode TEXT DEFAULT 'Cash',
      reference_no TEXT,
      status TEXT NOT NULL DEFAULT 'Pending',
      notes TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (scheme_id) REFERENCES chit_schemes(id) ON DELETE CASCADE,
      FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
      UNIQUE(scheme_id, member_id, month_number)
    );
  `);

  // 8. Dividends Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS dividends (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      auction_id INTEGER NOT NULL,
      scheme_id INTEGER NOT NULL,
      member_id INTEGER NOT NULL,
      month_number INTEGER NOT NULL,
      dividend_amount REAL NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (auction_id) REFERENCES auctions(id) ON DELETE CASCADE,
      FOREIGN KEY (scheme_id) REFERENCES chit_schemes(id) ON DELETE CASCADE,
      FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
    );
  `);

  // 9. Audit Logs Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      user_name TEXT,
      action TEXT NOT NULL,
      target TEXT NOT NULL,
      details TEXT,
      timestamp TEXT NOT NULL
    );
  `);

  // Run database seeding if empty
  seedDB();
}

function seedDB() {
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  if (userCount > 0) return;

  const now = new Date().toISOString();

  // 1. Seed Admin
  const adminPasswordHash = bcrypt.hashSync('admin123', 10);
  db.prepare(`
    INSERT INTO users (name, email, password_hash, role, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run('Admin Staff', 'admin@balajichit.com', adminPasswordHash, 'admin', now);

  // 2. Seed 20 Realistic Members
  const sampleMembers = [
    { name: 'Rajesh Kumar', email: 'rajesh.k@gmail.com', phone1: '9845012345', phone2: '9845099991', aadhaar: '458912348901' },
    { name: 'Priya Sundaram', email: 'priya.s@yahoo.com', phone1: '9731234567', phone2: '', aadhaar: '891234567890' },
    { name: 'Ramesh Verma', email: 'ramesh.verma@hotmail.com', phone1: '9880123456', phone2: '9880199992', aadhaar: '345678901234' },
    { name: 'Lakshmi Narayanan', email: 'lakshmi.n@outlook.com', phone1: '9900234567', phone2: '', aadhaar: '567890123456' },
    { name: 'Suresh Babu', email: 'suresh.b@gmail.com', phone1: '9844345678', phone2: '9844399993', aadhaar: '678901234567' },
    { name: 'Kavitha Reddy', email: 'kavitha.r@gmail.com', phone1: '9916456789', phone2: '', aadhaar: '789012345678' },
    { name: 'Venkatesh Rao', email: 'venkatesh.rao@gmail.com', phone1: '9448567890', phone2: '9448599994', aadhaar: '901234567890' },
    { name: 'Anitha Sharma', email: 'anitha.s@gmail.com', phone1: '9845678901', phone2: '', aadhaar: '123456789012' },
    { name: 'Vijay Anand', email: 'vijay.anand@yahoo.com', phone1: '9739789012', phone2: '9739799995', aadhaar: '234567890123' },
    { name: 'Deepa Krishnan', email: 'deepa.k@gmail.com', phone1: '9886890123', phone2: '', aadhaar: '432109876543' },
    { name: 'Manoj Patel', email: 'manoj.patel@gmail.com', phone1: '9901901234', phone2: '9901999996', aadhaar: '543210987654' },
    { name: 'Sunitha Roy', email: 'sunitha.roy@gmail.com', phone1: '9845019876', phone2: '', aadhaar: '654321098765' },
    { name: 'Karthik Subramanian', email: 'karthik.sub@gmail.com', phone1: '9731239876', phone2: '9731299997', aadhaar: '765432109876' },
    { name: 'Meena Kumari', email: 'meena.k@yahoo.com', phone1: '9880129876', phone2: '', aadhaar: '876543210987' },
    { name: 'Ganesh Iyer', email: 'ganesh.iyer@gmail.com', phone1: '9900239876', phone2: '9900299998', aadhaar: '987654321098' },
    { name: 'Swathi Menon', email: 'swathi.m@outlook.com', phone1: '9844349876', phone2: '', aadhaar: '109876543210' },
    { name: 'Arun Prasad', email: 'arun.prasad@gmail.com', phone1: '9916459876', phone2: '9916499999', aadhaar: '210987654321' },
    { name: 'Bhavana Hegde', email: 'bhavana.h@gmail.com', phone1: '9448569876', phone2: '', aadhaar: '321098765432' },
    { name: 'Sanjay Gupta', email: 'sanjay.g@gmail.com', phone1: '9845679876', phone2: '9845699900', aadhaar: '432109876541' },
    { name: 'Nandini Das', email: 'nandini.d@yahoo.com', phone1: '9739789876', phone2: '', aadhaar: '543210987652' }
  ];

  const insertMemberStmt = db.prepare(`
    INSERT INTO members (member_code, name, email, contact_no_1, contact_no_2, aadhaar_no, kyc_status, chit_status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 'Verified', 'Active', ?, ?)
  `);

  sampleMembers.forEach((m, idx) => {
    const code = `BSF-MBR-${1001 + idx}`;
    insertMemberStmt.run(code, m.name, m.email, m.phone1, m.phone2, m.aadhaar, now, now);
  });

  // 3. Seed Default ₹1,00,000 Scheme
  const schemeResult = db.prepare(`
    INSERT INTO chit_schemes (scheme_code, scheme_name, total_chit_value, duration_months, number_of_members, monthly_contribution, foreman_commission_percent, foreman_commission_amount, start_date, end_date, status, created_at)
    VALUES ('BSF-SCH-1001', '₹1,00,000 Chit Scheme', 100000, 20, 20, 5000, 5.0, 5000, '2026-01-01', '2027-08-31', 'Active', ?)
  `).run(now);

  const schemeId = schemeResult.lastInsertRowid;

  // 4. Enroll all 20 members into the scheme
  const insertEnrollment = db.prepare(`
    INSERT INTO chit_enrollments (scheme_id, member_id, ticket_number, enrolled_at, status)
    VALUES (?, ?, ?, ?, 'Active')
  `);

  for (let i = 1; i <= 20; i++) {
    insertEnrollment.run(schemeId, i, i, now);
  }

  // 5. Seed Demo Month 1 Auction
  const auctionResult = db.prepare(`
    INSERT INTO auctions (scheme_id, month_number, auction_date, winning_member_id, winning_bid_discount, foreman_commission, winner_payout, dividend_pool, dividend_per_member, next_month_payable, notes, created_at)
    VALUES (?, 1, '2026-01-15', 3, 15000, 5000, 85000, 10000, 500, 4500, 'First month auction successfully completed.', ?)
  `).run(schemeId, now);

  const auctionId = auctionResult.lastInsertRowid;

  // 6. Seed Month 1 Payments & Dividends for all 20 members
  const insertPayment = db.prepare(`
    INSERT INTO monthly_payments (scheme_id, member_id, month_number, base_contribution, dividend_applied, net_amount_due, amount_paid, payment_date, payment_mode, reference_no, status, notes, created_at)
    VALUES (?, ?, 1, 5000, 500, 4500, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertDividend = db.prepare(`
    INSERT INTO dividends (auction_id, scheme_id, member_id, month_number, dividend_amount, created_at)
    VALUES (?, ?, ?, 1, 500, ?)
  `);

  for (let mId = 1; mId <= 20; mId++) {
    insertDividend.run(auctionId, schemeId, mId, now);

    let amountPaid = 4500;
    let payDate = '2026-01-20';
    let payMode = 'UPI';
    let refNo = `UPI/20260120/00${mId}`;
    let status = 'Paid';

    if (mId === 18 || mId === 19) {
      amountPaid = 0;
      payDate = null;
      payMode = null;
      refNo = null;
      status = 'Pending';
    } else if (mId === 20) {
      amountPaid = 2500;
      payDate = '2026-01-22';
      payMode = 'Cash';
      refNo = 'CSH-0912';
      status = 'Partially Paid';
    }

    insertPayment.run(schemeId, mId, amountPaid, payDate, payMode, refNo, status, 'Month 1 Contribution', now);
  }

  // 7. Seed Initial Audit Log
  db.prepare(`
    INSERT INTO audit_logs (user_id, user_name, action, target, details, timestamp)
    VALUES (1, 'Admin Staff', 'SYSTEM_INITIALIZED', 'Database', 'Initial database seed complete with default ₹1,00,000 scheme & 20 members.', ?)
  `).run(now);
}

initDB();

module.exports = db;

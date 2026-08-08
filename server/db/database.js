const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

let db;
let isNative = false;

// Force JS engine on Vercel to guarantee 0 native C++ crashes
const isVercel = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

if (!isVercel) {
  try {
    const Database = require('better-sqlite3');
    const dbPath = path.join(__dirname, 'balaji_chitfund.db');
    db = new Database(dbPath, { verbose: null });
    db.pragma('foreign_keys = ON');
    isNative = true;
  } catch (error) {
    isNative = false;
  }
}

if (!isNative) {
  console.log('Running Serverless JS Relational Engine for Vercel Environment.');

  const memoryStore = {
    users: [],
    members: [],
    kyc_documents: [],
    chit_schemes: [],
    chit_enrollments: [],
    auctions: [],
    monthly_payments: [],
    dividends: [],
    audit_logs: []
  };

  let autoId = {
    users: 1, members: 1, kyc_documents: 1, chit_schemes: 1,
    chit_enrollments: 1, auctions: 1, monthly_payments: 1, dividends: 1, audit_logs: 1
  };

  db = {
    exec: () => {},
    pragma: () => {},
    prepare: (sql) => {
      const cleanSql = sql.trim();
      return {
        get: (...params) => {
          if (cleanSql.includes('FROM users WHERE email = ?')) {
            const em = String(params[0] || '').trim().toLowerCase();
            return memoryStore.users.find(u => u.email.toLowerCase() === em);
          }
          if (cleanSql.includes('FROM users WHERE id = ?')) {
            return memoryStore.users.find(u => u.id === Number(params[0]));
          }
          if (cleanSql.includes('SELECT COUNT(*) as count FROM users')) {
            return { count: memoryStore.users.length };
          }
          if (cleanSql.includes('SELECT MAX(id) as max_id FROM members')) {
            const max = memoryStore.members.reduce((m, item) => item.id > m ? item.id : m, 0);
            return { max_id: max };
          }
          if (cleanSql.includes('SELECT MAX(id) as max_id FROM chit_schemes')) {
            const max = memoryStore.chit_schemes.reduce((m, item) => item.id > m ? item.id : m, 0);
            return { max_id: max };
          }
          if (cleanSql.includes('SELECT * FROM members WHERE id = ?')) {
            return memoryStore.members.find(m => m.id === Number(params[0]));
          }
          if (cleanSql.includes('SELECT * FROM chit_schemes WHERE id = ?')) {
            return memoryStore.chit_schemes.find(s => s.id === Number(params[0]));
          }
          if (cleanSql.includes('SELECT COUNT(*) as cnt FROM chit_enrollments WHERE scheme_id = ?')) {
            const cnt = memoryStore.chit_enrollments.filter(e => e.scheme_id === Number(params[0])).length;
            return { cnt, total: cnt };
          }
          if (cleanSql.includes('SELECT COUNT(*) as cnt FROM auctions WHERE scheme_id = ?')) {
            const cnt = memoryStore.auctions.filter(a => a.scheme_id === Number(params[0])).length;
            return { cnt };
          }
          if (cleanSql.includes('SELECT COUNT(*) as cnt FROM chit_schemes WHERE status = ?')) {
            const cnt = memoryStore.chit_schemes.filter(s => s.status === params[0]).length;
            return { cnt };
          }
          if (cleanSql.includes('SELECT COUNT(*) as cnt FROM members')) {
            return { cnt: memoryStore.members.filter(m => m.chit_status !== 'Deactivated').length };
          }
          if (cleanSql.includes('SUM(total_chit_value)')) {
            const total = memoryStore.chit_schemes.filter(s => s.status === 'Active').reduce((acc, s) => acc + s.total_chit_value, 0);
            return { total };
          }
          if (cleanSql.includes('SUM(amount_paid)')) {
            const total = memoryStore.monthly_payments.reduce((acc, p) => acc + (p.amount_paid || 0), 0);
            return { total };
          }
          if (cleanSql.includes('SUM(dividend_amount)')) {
            const total = memoryStore.dividends.reduce((acc, d) => acc + (d.dividend_amount || 0), 0);
            return { total };
          }
          if (cleanSql.includes('SUM(net_amount_due - amount_paid)')) {
            const total = memoryStore.monthly_payments
              .filter(p => ['Pending', 'Partially Paid', 'Overdue'].includes(p.status))
              .reduce((acc, p) => acc + (p.net_amount_due - p.amount_paid), 0);
            return { total };
          }
          if (cleanSql.includes('SELECT * FROM kyc_documents WHERE id = ? AND member_id = ?')) {
            return memoryStore.kyc_documents.find(d => d.id === Number(params[1]) && d.member_id === Number(params[0]));
          }
          if (cleanSql.includes('SELECT id FROM chit_enrollments WHERE scheme_id = ? AND member_id = ?')) {
            return memoryStore.chit_enrollments.find(e => e.scheme_id === Number(params[0]) && e.member_id === Number(params[1]));
          }
          if (cleanSql.includes('SELECT id FROM chit_enrollments WHERE scheme_id = ? AND ticket_number = ?')) {
            return memoryStore.chit_enrollments.find(e => e.scheme_id === Number(params[0]) && e.ticket_number === Number(params[1]));
          }
          if (cleanSql.includes('SELECT id FROM auctions WHERE scheme_id = ? AND month_number = ?')) {
            return memoryStore.auctions.find(a => a.scheme_id === Number(params[0]) && a.month_number === Number(params[1]));
          }
          if (cleanSql.includes('SELECT id, month_number FROM auctions WHERE scheme_id = ? AND winning_member_id = ?')) {
            return memoryStore.auctions.find(a => a.scheme_id === Number(params[0]) && a.winning_member_id === Number(params[1]));
          }
          if (cleanSql.includes('SELECT * FROM monthly_payments WHERE id = ?')) {
            return memoryStore.monthly_payments.find(p => p.id === Number(params[0]));
          }
          if (cleanSql.includes('SELECT * FROM monthly_payments WHERE scheme_id = ? AND member_id = ? AND month_number = ?')) {
            return memoryStore.monthly_payments.find(p => p.scheme_id === Number(params[0]) && p.member_id === Number(params[1]) && p.month_number === Number(params[2]));
          }
          if (cleanSql.includes('SELECT id FROM members WHERE email = ?')) {
            return memoryStore.members.find(m => m.email.toLowerCase() === String(params[0]).toLowerCase());
          }
          if (cleanSql.includes('SELECT id FROM members WHERE aadhaar_no = ?')) {
            return memoryStore.members.find(m => m.aadhaar_no === String(params[0]));
          }
          return null;
        },
        all: (...params) => {
          if (cleanSql.includes('FROM members')) {
            let list = [...memoryStore.members];
            return list;
          }
          if (cleanSql.includes('FROM chit_schemes')) {
            return [...memoryStore.chit_schemes];
          }
          if (cleanSql.includes('FROM auctions')) {
            return memoryStore.auctions.map(a => {
              const sch = memoryStore.chit_schemes.find(s => s.id === a.scheme_id) || {};
              const mbr = memoryStore.members.find(m => m.id === a.winning_member_id) || {};
              return {
                ...a,
                scheme_name: sch.scheme_name,
                scheme_code: sch.scheme_code,
                winner_name: mbr.name,
                winner_code: mbr.member_code
              };
            });
          }
          if (cleanSql.includes('FROM monthly_payments')) {
            return memoryStore.monthly_payments.map(p => {
              const sch = memoryStore.chit_schemes.find(s => s.id === p.scheme_id) || {};
              const mbr = memoryStore.members.find(m => m.id === p.member_id) || {};
              return {
                ...p,
                scheme_name: sch.scheme_name,
                scheme_code: sch.scheme_code,
                member_name: mbr.name,
                member_code: mbr.member_code,
                contact_no_1: mbr.contact_no_1,
                pending_balance: p.net_amount_due - p.amount_paid
              };
            });
          }
          if (cleanSql.includes('FROM dividends')) {
            return memoryStore.dividends.map(d => {
              const sch = memoryStore.chit_schemes.find(s => s.id === d.scheme_id) || {};
              const mbr = memoryStore.members.find(m => m.id === d.member_id) || {};
              const auc = memoryStore.auctions.find(a => a.id === d.auction_id) || {};
              return {
                ...d,
                scheme_name: sch.scheme_name,
                scheme_code: sch.scheme_code,
                member_name: mbr.name,
                member_code: mbr.member_code,
                winning_bid_discount: auc.winning_bid_discount || 0,
                foreman_commission: auc.foreman_commission || 0,
                dividend_pool: auc.dividend_pool || 0
              };
            });
          }
          if (cleanSql.includes('FROM audit_logs')) {
            return [...memoryStore.audit_logs];
          }
          if (cleanSql.includes('FROM kyc_documents')) {
            return memoryStore.kyc_documents.filter(doc => doc.member_id === Number(params[0]));
          }
          if (cleanSql.includes('FROM chit_enrollments')) {
            return memoryStore.chit_enrollments
              .filter(ce => ce.scheme_id === Number(params[0]))
              .map(ce => {
                const m = memoryStore.members.find(mbr => mbr.id === ce.member_id) || {};
                return {
                  enrollment_id: ce.id,
                  ticket_number: ce.ticket_number,
                  enrolled_at: ce.enrolled_at,
                  member_id: m.id,
                  member_code: m.member_code,
                  name: m.name,
                  email: m.email,
                  contact_no_1: m.contact_no_1,
                  aadhaar_no: m.aadhaar_no,
                  kyc_status: m.kyc_status
                };
              });
          }
          return [];
        },
        run: (...params) => {
          if (cleanSql.includes('INSERT INTO users')) {
            const id = autoId.users++;
            memoryStore.users.push({ id, name: params[0], email: params[1], password_hash: params[2], role: params[3], created_at: params[4] });
            return { lastInsertRowid: id };
          }
          if (cleanSql.includes('INSERT INTO members')) {
            const id = autoId.members++;
            memoryStore.members.unshift({
              id, member_code: params[0], name: params[1], email: params[2],
              contact_no_1: params[3], contact_no_2: params[4], aadhaar_no: params[5],
              kyc_status: params[6] || 'Verified', chit_status: params[7] || 'Active',
              created_at: params[8] || new Date().toISOString(), updated_at: params[9] || new Date().toISOString()
            });
            return { lastInsertRowid: id };
          }
          if (cleanSql.includes('INSERT INTO kyc_documents')) {
            const id = autoId.kyc_documents++;
            memoryStore.kyc_documents.push({
              id, member_id: params[0], document_type: params[1], file_name: params[2],
              original_name: params[3], file_path: params[4], mime_type: params[5],
              file_size: params[6], uploaded_at: params[7]
            });
            return { lastInsertRowid: id };
          }
          if (cleanSql.includes('INSERT INTO chit_schemes')) {
            const id = autoId.chit_schemes++;
            memoryStore.chit_schemes.unshift({
              id, scheme_code: params[0], scheme_name: params[1], total_chit_value: params[2],
              duration_months: params[3], number_of_members: params[4], monthly_contribution: params[5],
              foreman_commission_percent: params[6], foreman_commission_amount: params[7],
              start_date: params[8], end_date: params[9], status: 'Active', created_at: params[10]
            });
            return { lastInsertRowid: id };
          }
          if (cleanSql.includes('INSERT INTO chit_enrollments')) {
            const id = autoId.chit_enrollments++;
            memoryStore.chit_enrollments.push({ id, scheme_id: params[0], member_id: params[1], ticket_number: params[2], enrolled_at: params[3], status: 'Active' });
            return { lastInsertRowid: id };
          }
          if (cleanSql.includes('INSERT INTO auctions')) {
            const id = autoId.auctions++;
            memoryStore.auctions.unshift({
              id, scheme_id: params[0], month_number: params[1], auction_date: params[2],
              winning_member_id: params[3], winning_bid_discount: params[4], foreman_commission: params[5],
              winner_payout: params[6], dividend_pool: params[7], dividend_per_member: params[8],
              next_month_payable: params[9], notes: params[10], created_at: params[11]
            });
            return { lastInsertRowid: id };
          }
          if (cleanSql.includes('INSERT INTO monthly_payments')) {
            const existing = memoryStore.monthly_payments.find(p => p.scheme_id === Number(params[0]) && p.member_id === Number(params[1]) && p.month_number === Number(params[2]));
            if (existing) {
              existing.dividend_applied = params[4];
              existing.net_amount_due = params[5];
              return { lastInsertRowid: existing.id };
            }
            const id = autoId.monthly_payments++;
            memoryStore.monthly_payments.unshift({
              id, scheme_id: params[0], member_id: params[1], month_number: params[2],
              base_contribution: params[3], dividend_applied: params[4], net_amount_due: params[5],
              amount_paid: params[6] || 0, status: params[7] || 'Pending', notes: params[8] || '', created_at: params[9]
            });
            return { lastInsertRowid: id };
          }
          if (cleanSql.includes('INSERT INTO dividends')) {
            const id = autoId.dividends++;
            memoryStore.dividends.unshift({
              id, auction_id: params[0], scheme_id: params[1], member_id: params[2],
              month_number: params[3], dividend_amount: params[4], created_at: params[5]
            });
            return { lastInsertRowid: id };
          }
          if (cleanSql.includes('INSERT INTO audit_logs')) {
            const id = autoId.audit_logs++;
            memoryStore.audit_logs.unshift({ id, user_id: params[0], user_name: params[1], action: params[2], target: params[3], details: params[4], timestamp: params[5] });
            return { lastInsertRowid: id };
          }
          if (cleanSql.includes('UPDATE monthly_payments')) {
            const pId = params[params.length - 1];
            const item = memoryStore.monthly_payments.find(p => p.id === Number(pId));
            if (item) {
              item.amount_paid = params[0];
              item.payment_date = params[1];
              item.payment_mode = params[2];
              item.reference_no = params[3];
              item.status = params[4];
              item.notes = params[5];
            }
            return { changes: 1 };
          }
          if (cleanSql.includes('UPDATE members')) {
            const mId = params[params.length - 1];
            const item = memoryStore.members.find(m => m.id === Number(mId));
            if (item) {
              if (params.length >= 8) {
                item.name = params[0]; item.email = params[1]; item.contact_no_1 = params[2];
                item.contact_no_2 = params[3]; item.aadhaar_no = params[4]; item.kyc_status = params[5];
                item.chit_status = params[6];
              } else {
                item.chit_status = 'Deactivated'; item.kyc_status = 'Inactive';
              }
            }
            return { changes: 1 };
          }
          if (cleanSql.includes('DELETE FROM chit_enrollments')) {
            const enrollId = params[0];
            memoryStore.chit_enrollments = memoryStore.chit_enrollments.filter(e => e.id !== Number(enrollId));
            return { changes: 1 };
          }
          return { lastInsertRowid: 1, changes: 1 };
        }
      };
    },
    transaction: (fn) => fn
  };

  // Seed initial memory DB
  seedMemoryDB(db);
}

function seedMemoryDB(database) {
  const now = new Date().toISOString();
  const adminPasswordHash = bcrypt.hashSync('admin123', 10);
  database.prepare('INSERT INTO users').run('Admin Staff', 'admin@balajichit.com', adminPasswordHash, 'admin', now);

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

  sampleMembers.forEach((m, idx) => {
    database.prepare('INSERT INTO members').run(`BSF-MBR-${1001 + idx}`, m.name, m.email, m.phone1, m.phone2, m.aadhaar, 'Verified', 'Active', now, now);
  });

  database.prepare('INSERT INTO chit_schemes').run('BSF-SCH-1001', '₹1,00,000 Chit Scheme', 100000, 20, 20, 5000, 5.0, 5000, '2026-01-01', '2027-08-31', now);

  for (let i = 1; i <= 20; i++) {
    database.prepare('INSERT INTO chit_enrollments').run(1, i, i, now);
  }

  database.prepare('INSERT INTO auctions').run(1, 1, '2026-01-15', 3, 15000, 5000, 85000, 10000, 500, 4500, 'First month auction successfully completed.', now);

  for (let mId = 1; mId <= 20; mId++) {
    database.prepare('INSERT INTO dividends').run(1, 1, mId, 1, 500, now);
    let amountPaid = 4500;
    let status = 'Paid';
    if (mId === 18 || mId === 19) { amountPaid = 0; status = 'Pending'; }
    else if (mId === 20) { amountPaid = 2500; status = 'Partially Paid'; }
    database.prepare('INSERT INTO monthly_payments').run(1, mId, 1, 5000, 500, 4500, amountPaid, status, 'Month 1 Contribution', now);
  }

  database.prepare('INSERT INTO audit_logs').run(1, 'Admin Staff', 'SYSTEM_INITIALIZED', 'Database', 'Initial database seed complete.', now);
}

if (isNative && typeof db.exec === 'function') {
  function initDB() {
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'admin',
        created_at TEXT NOT NULL
      );
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
      CREATE TABLE IF NOT EXISTS kyc_documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        member_id INTEGER NOT NULL,
        document_type TEXT NOT NULL,
        file_name TEXT NOT NULL,
        original_name TEXT NOT NULL,
        file_path TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        uploaded_at TEXT NOT NULL
      );
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
      CREATE TABLE IF NOT EXISTS chit_enrollments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        scheme_id INTEGER NOT NULL,
        member_id INTEGER NOT NULL,
        ticket_number INTEGER NOT NULL,
        enrolled_at TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'Active',
        UNIQUE(scheme_id, ticket_number),
        UNIQUE(scheme_id, member_id)
      );
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
        UNIQUE(scheme_id, month_number)
      );
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
        UNIQUE(scheme_id, member_id, month_number)
      );
      CREATE TABLE IF NOT EXISTS dividends (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        auction_id INTEGER NOT NULL,
        scheme_id INTEGER NOT NULL,
        member_id INTEGER NOT NULL,
        month_number INTEGER NOT NULL,
        dividend_amount REAL NOT NULL,
        created_at TEXT NOT NULL
      );
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

    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
    if (userCount === 0) {
      seedMemoryDB(db);
    }
  }
  initDB();
}

module.exports = db;

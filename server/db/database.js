const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

let db;
let isNative = false;

const supabase = require('./supabase');

// Shared JS Relational Engine with Supabase Cloud DB Persistence for both Localhost & Vercel
isNative = false;
console.log('Running Unified JS Relational Engine connected to Supabase Cloud DB (Localhost & Vercel synchronized).');

  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@balajichit.com').trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  const defaultPasswordHash = bcrypt.hashSync(adminPassword, 10);

  const defaultAdminUser = {
    id: 1,
    name: 'Admin Staff',
    email: adminEmail,
    password_hash: defaultPasswordHash,
    role: 'Admin',
    created_at: new Date().toISOString()
  };

  const memoryStore = {
    users: [defaultAdminUser],
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
    users: 2, members: 1, kyc_documents: 1, chit_schemes: 1,
    chit_enrollments: 1, auctions: 1, monthly_payments: 1, dividends: 1, audit_logs: 1
  };

  let lastSyncTime = 0;

  async function syncFromSupabase() {
    try {
      const results = await Promise.all([
        supabase.from('users').select('*'),
        supabase.from('members').select('*').order('id', { ascending: false }),
        supabase.from('kyc_documents').select('*'),
        supabase.from('chit_schemes').select('*').order('id', { ascending: false }),
        supabase.from('chit_enrollments').select('*'),
        supabase.from('auctions').select('*').order('id', { ascending: false }),
        supabase.from('monthly_payments').select('*').order('id', { ascending: false }),
        supabase.from('dividends').select('*').order('id', { ascending: false }),
        supabase.from('audit_logs').select('*').order('id', { ascending: false })
      ]).catch(e => {
        console.warn('Supabase fetch error:', e.message);
        return [];
      });

      const users = results[0] && results[0].data;
      const members = results[1] && results[1].data;
      const kycDocs = results[2] && results[2].data;
      const schemes = results[3] && results[3].data;
      const enrollments = results[4] && results[4].data;
      const auctions = results[5] && results[5].data;
      const payments = results[6] && results[6].data;
      const dividends = results[7] && results[7].data;
      const auditLogs = results[8] && results[8].data;

      if (users && Array.isArray(users) && users.length > 0) {
        memoryStore.users = users;
      }
      const existingAdmin = memoryStore.users.find(u => u && u.email && u.email.toLowerCase() === adminEmail);
      if (!existingAdmin) {
        memoryStore.users.push(defaultAdminUser);
      } else if (!existingAdmin.password_hash || !bcrypt.compareSync(adminPassword, existingAdmin.password_hash)) {
        existingAdmin.password_hash = defaultPasswordHash;
        if (existingAdmin.id) {
          supabase.from('users').update({ password_hash: defaultPasswordHash }).eq('id', existingAdmin.id).then(r => {
            if (r.error) console.error('Supabase admin hash repair error:', r.error);
          });
        }
      }

      if (members && Array.isArray(members)) memoryStore.members = members;
      if (kycDocs && Array.isArray(kycDocs)) memoryStore.kyc_documents = kycDocs;
      if (schemes && Array.isArray(schemes)) memoryStore.chit_schemes = schemes;
      if (enrollments && Array.isArray(enrollments)) memoryStore.chit_enrollments = enrollments;
      if (auctions && Array.isArray(auctions)) memoryStore.auctions = auctions;
      if (payments && Array.isArray(payments)) memoryStore.monthly_payments = payments;
      if (dividends && Array.isArray(dividends)) memoryStore.dividends = dividends;
      if (auditLogs && Array.isArray(auditLogs)) memoryStore.audit_logs = auditLogs;

      // Update max autoId counters
      const tables = ['users', 'members', 'kyc_documents', 'chit_schemes', 'chit_enrollments', 'auctions', 'monthly_payments', 'dividends', 'audit_logs'];
      tables.forEach(tbl => {
        if (memoryStore[tbl] && memoryStore[tbl].length > 0) {
          const max = memoryStore[tbl].reduce((m, item) => (item && item.id > m ? item.id : m), 0);
          autoId[tbl] = max + 1;
        }
      });
      lastSyncTime = Date.now();
    } catch (e) {
      console.warn('Supabase sync warning:', e.message);
    }
  }

  // Trigger sync on cold start
  syncFromSupabase();

  db = {
    syncFromSupabase,
    exec: () => {},
    pragma: () => {},
    prepare: (sql) => {
      if (Date.now() - lastSyncTime > 3000) {
        syncFromSupabase();
      }
      const cleanSql = String(sql || '').trim();
      return {
        get: (...params) => {
          try {
            if (cleanSql.includes('FROM users WHERE email = ?')) {
              const em = String(params[0] || '').trim().toLowerCase();
              return memoryStore.users.find(u => u && u.email && u.email.toLowerCase() === em);
            }
            if (cleanSql.includes('WHERE email = ?') && cleanSql.includes('users')) {
              return memoryStore.users.find(u => u && u.email && u.email.toLowerCase() === String(params[0]).toLowerCase());
            }
            if (cleanSql.includes('FROM users WHERE id = ?')) {
              return memoryStore.users.find(u => u && u.id === Number(params[0]));
            }
            if (cleanSql.includes('COUNT') && cleanSql.includes('users')) {
              return { count: memoryStore.users.length, cnt: memoryStore.users.length };
            }
            if (cleanSql.includes('SELECT MAX(id) as max_id FROM members')) {
              const max = memoryStore.members.reduce((m, item) => (item && item.id > m ? item.id : m), 0);
              return { max_id: max };
            }
            if (cleanSql.includes('SELECT MAX(id) as max_id FROM chit_schemes')) {
              const max = memoryStore.chit_schemes.reduce((m, item) => (item && item.id > m ? item.id : m), 0);
              return { max_id: max };
            }
            if (cleanSql.includes('SELECT * FROM members WHERE id = ?')) {
              return memoryStore.members.find(m => m && (m.id === Number(params[0]) || String(m.id) === String(params[0]) || m.member_code === String(params[0])));
            }
            if (cleanSql.includes('SELECT * FROM chit_schemes WHERE id = ?')) {
              return memoryStore.chit_schemes.find(s => s && (s.id === Number(params[0]) || String(s.id) === String(params[0]) || s.scheme_code === String(params[0])));
            }
            if (cleanSql.includes('SELECT * FROM chit_schemes WHERE scheme_code = ?')) {
              return memoryStore.chit_schemes.find(s => s && s.scheme_code && String(s.scheme_code).toLowerCase() === String(params[0]).toLowerCase());
            }
            if (cleanSql.includes('SELECT id FROM chit_enrollments WHERE scheme_id = ? AND member_id = ?')) {
              return memoryStore.chit_enrollments.find(e => e && e.scheme_id === Number(params[0]) && e.member_id === Number(params[1]));
            }
            if (cleanSql.includes('SELECT id FROM chit_enrollments WHERE scheme_id = ? AND ticket_number = ?')) {
              const schParam = params[0];
              const tckParam = Number(params[1]);
              return memoryStore.chit_enrollments.find(e => e && (e.scheme_id === Number(schParam) || String(e.scheme_id) === String(schParam)) && Number(e.ticket_number) === tckParam);
            }
            if (cleanSql.includes('FROM chit_enrollments') && (cleanSql.includes('COUNT') || cleanSql.includes('cnt'))) {
              const schId = params[0] ? Number(params[0]) : null;
              const cnt = schId ? memoryStore.chit_enrollments.filter(e => e && e.scheme_id === schId).length : memoryStore.chit_enrollments.length;
              return { cnt, total: cnt, count: cnt };
            }
            if (cleanSql.includes('FROM auctions') && (cleanSql.includes('COUNT') || cleanSql.includes('cnt'))) {
              const schId = params[0] ? Number(params[0]) : null;
              const cnt = schId ? memoryStore.auctions.filter(a => a && a.scheme_id === schId).length : memoryStore.auctions.length;
              return { cnt, total: cnt, count: cnt };
            }
            if (cleanSql.includes('SELECT id FROM auctions WHERE scheme_id = ? AND month_number = ?')) {
              const schId = params[0];
              return memoryStore.auctions.find(a => a && (a.scheme_id === Number(schId) || String(a.scheme_id) === String(schId)) && a.month_number === Number(params[1]));
            }
            if (cleanSql.includes('winning_ticket_number') && cleanSql.includes('winning_member_id') && cleanSql.includes('auctions')) {
              const schId = params[0]; const ticketNo = params[1]; const memberId = params[2];
              return memoryStore.auctions.find(a => a && (a.scheme_id === Number(schId) || String(a.scheme_id) === String(schId)) && Number(a.winning_ticket_number) === Number(ticketNo) && Number(a.winning_member_id) === Number(memberId));
            }
            if (cleanSql.includes('SELECT * FROM auctions WHERE id = ?') || cleanSql.includes('FROM auctions WHERE id = ?')) {
              return memoryStore.auctions.find(a => a && (a.id === Number(params[0]) || String(a.id) === String(params[0])));
            }
            if (cleanSql.includes('SELECT * FROM auctions WHERE scheme_id = ? AND month_number = ?')) {
              const schId = params[0];
              const mNum = Number(params[1]);
              return memoryStore.auctions.find(a => a && (a.scheme_id === Number(schId) || String(a.scheme_id) === String(schId)) && a.month_number === mNum);
            }
            if (cleanSql.includes('SELECT id, month_number FROM auctions WHERE scheme_id = ? AND winning_member_id = ?')) {
              const schId = params[0];
              return memoryStore.auctions.find(a => a && (a.scheme_id === Number(schId) || String(a.scheme_id) === String(schId)) && a.winning_member_id === Number(params[1]));
            }
            if (cleanSql.includes('SELECT * FROM monthly_payments WHERE id = ?')) {
              return memoryStore.monthly_payments.find(p => p && p.id === Number(params[0]));
            }
            if (cleanSql.includes('SELECT * FROM monthly_payments WHERE scheme_id = ? AND member_id = ? AND month_number = ?')) {
              return memoryStore.monthly_payments.find(p => p && p.scheme_id === Number(params[0]) && p.member_id === Number(params[1]) && p.month_number === Number(params[2]));
            }
            if (cleanSql.includes('FROM members') && (cleanSql.includes('COUNT') || cleanSql.includes('cnt'))) {
              const cnt = memoryStore.members.filter(m => m && m.chit_status !== 'Deactivated').length;
              return { cnt, count: cnt };
            }
            if (cleanSql.includes('FROM chit_schemes') && (cleanSql.includes('COUNT') || cleanSql.includes('SUM'))) {
              let targetStatus = params[0];
              if (!targetStatus) {
                if (cleanSql.includes("'Active'")) targetStatus = 'Active';
                else if (cleanSql.includes("'Completed'")) targetStatus = 'Completed';
                else if (cleanSql.includes("'Upcoming'")) targetStatus = 'Upcoming';
              }
              const cnt = targetStatus
                ? memoryStore.chit_schemes.filter(s => s && s.status === targetStatus).length
                : memoryStore.chit_schemes.length;
              const totalVal = memoryStore.chit_schemes
                .filter(s => s && (targetStatus ? s.status === targetStatus : true))
                .reduce((acc, s) => acc + (Number(s.total_chit_value) || 0), 0);
              return { cnt, count: cnt, total: totalVal };
            }
            if (cleanSql.includes('SUM(total_chit_value)')) {
              const total = memoryStore.chit_schemes.filter(s => s && s.status === 'Active').reduce((acc, s) => acc + (Number(s.total_chit_value) || 0), 0);
              return { total };
            }
            if (cleanSql.includes('SUM(amount_paid)')) {
              const total = memoryStore.monthly_payments.reduce((acc, p) => acc + (Number(p.amount_paid) || 0), 0);
              return { total };
            }
            if (cleanSql.includes('SUM(dividend_amount)')) {
              const total = memoryStore.dividends.reduce((acc, d) => acc + (Number(d.dividend_amount) || 0), 0);
              return { total };
            }
            if (cleanSql.includes('SUM(net_amount_due - amount_paid)')) {
              const total = memoryStore.monthly_payments
                .filter(p => p && ['Pending', 'Partially Paid', 'Overdue'].includes(p.status))
                .reduce((acc, p) => acc + ((Number(p.net_amount_due) || 0) - (Number(p.amount_paid) || 0)), 0);
              return { total };
            }
            if (cleanSql.includes('SELECT id FROM members WHERE email = ?')) {
              return memoryStore.members.find(m => m && m.email && m.email.toLowerCase() === String(params[0]).toLowerCase());
            }
            if (cleanSql.includes('SELECT id FROM members WHERE aadhaar_no = ?')) {
              return memoryStore.members.find(m => m && m.aadhaar_no === String(params[0]));
            }
            if (cleanSql.includes('SELECT id FROM members WHERE member_code = ?')) {
              return memoryStore.members.find(m => m && m.member_code && String(m.member_code).trim().toLowerCase() === String(params[0]).trim().toLowerCase());
            }
          } catch (e) {
            console.error('JS Engine GET error:', e);
          }
          if (cleanSql.includes('COUNT') || cleanSql.includes('MAX') || cleanSql.includes('SUM')) {
            return { cnt: 0, count: 0, total: 0, max_id: 0 };
          }
          return undefined;
        },
        all: (...params) => {
          try {
            if (cleanSql.includes('FROM members')) {
              let filtered = [...memoryStore.members];
              let pIdx = 0;

              if (cleanSql.includes('LIKE ?')) {
                const sVal = String(params[pIdx] || '').replace(/%/g, '').toLowerCase();
                pIdx += 4;
                if (sVal) {
                  filtered = filtered.filter(m => m && (
                    (m.name && m.name.toLowerCase().includes(sVal)) ||
                    (m.email && m.email.toLowerCase().includes(sVal)) ||
                    (m.contact_no_1 && m.contact_no_1.includes(sVal)) ||
                    (m.member_code && m.member_code.toLowerCase().includes(sVal))
                  ));
                }
              }

              if (cleanSql.includes('kyc_status = ?')) {
                const kVal = params[pIdx++];
                if (kVal != null && kVal !== '') {
                  filtered = filtered.filter(m => m && String(m.kyc_status).toLowerCase() === String(kVal).toLowerCase());
                }
              }

              if (cleanSql.includes('chit_status = ?')) {
                const cVal = params[pIdx++];
                if (cVal != null && cVal !== '') {
                  filtered = filtered.filter(m => m && String(m.chit_status).toLowerCase() === String(cVal).toLowerCase());
                }
              }

              return filtered;
            }
            if (cleanSql.includes('FROM chit_schemes')) {
              return [...memoryStore.chit_schemes];
            }
            if (cleanSql.includes('FROM auctions')) {
              let filtered = [...memoryStore.auctions];
              if (params.length >= 1 && params[0] != null) {
                const schId = Number(params[0]);
                filtered = filtered.filter(a => a && a.scheme_id === schId);
              }
              return filtered.map(a => {
                const sch = memoryStore.chit_schemes.find(s => s && s.id === a.scheme_id) || {};
                const mbr = memoryStore.members.find(m => m && m.id === a.winning_member_id) || {};
                return {
                  ...a,
                  scheme_name: sch.scheme_name,
                  scheme_code: sch.scheme_code,
                  winner_name: mbr.name || ('Member #' + (a.winning_member_id || '')),
                  winner_code: mbr.member_code || ''
                };
              });
            }
            if (cleanSql.includes('FROM monthly_payments')) {
              if (cleanSql.includes('GROUP BY month_number')) {
                const grouped = {};
                memoryStore.monthly_payments.forEach(p => {
                  const m = p.month_number || 1;
                  if (!grouped[m]) grouped[m] = { month_number: m, collected: 0, target: 0 };
                  grouped[m].collected += (Number(p.amount_paid) || 0);
                  grouped[m].target += (Number(p.net_amount_due) || 0);
                });
                return Object.values(grouped);
              }

              let filtered = [...memoryStore.monthly_payments];

              let pIdx = 0;
              if (cleanSql.includes('mp.scheme_id = ?') || cleanSql.includes('scheme_id = ?')) {
                const schVal = params[pIdx++];
                if (schVal != null && schVal !== '') {
                  filtered = filtered.filter(p => p && (p.scheme_id === Number(schVal) || String(p.scheme_id) === String(schVal)));
                }
              }
              if (cleanSql.includes('mp.month_number = ?') || cleanSql.includes('month_number = ?')) {
                const mVal = params[pIdx++];
                if (mVal != null && mVal !== '') {
                  filtered = filtered.filter(p => p && Number(p.month_number) === Number(mVal));
                }
              }
              if (cleanSql.includes('mp.member_id = ?') || cleanSql.includes('member_id = ?')) {
                const mbrVal = params[pIdx++];
                if (mbrVal != null && mbrVal !== '') {
                  filtered = filtered.filter(p => p && (p.member_id === Number(mbrVal) || String(p.member_id) === String(mbrVal)));
                }
              }
              if (cleanSql.includes('mp.status = ?') || cleanSql.includes('status = ?')) {
                const stVal = params[pIdx++];
                if (stVal != null && stVal !== '') {
                  filtered = filtered.filter(p => p && String(p.status).toLowerCase() === String(stVal).toLowerCase());
                }
              }
              if (cleanSql.includes('LIKE ?')) {
                const srchVal = String(params[pIdx] || '').replace(/%/g, '').toLowerCase();
                if (srchVal) {
                  filtered = filtered.filter(p => {
                    const mbr = memoryStore.members.find(m => m && m.id === p.member_id) || {};
                    return (
                      (mbr.name && mbr.name.toLowerCase().includes(srchVal)) ||
                      (mbr.member_code && mbr.member_code.toLowerCase().includes(srchVal)) ||
                      (p.reference_no && p.reference_no.toLowerCase().includes(srchVal))
                    );
                  });
                }
              }

              return filtered.map(p => {
                const sch = memoryStore.chit_schemes.find(s => s && (s.id === p.scheme_id || String(s.id) === String(p.scheme_id))) || {};
                const mbr = memoryStore.members.find(m => m && (m.id === p.member_id || String(m.id) === String(p.member_id))) || {};
                return {
                  ...p,
                  scheme_name: sch.scheme_name,
                  scheme_code: sch.scheme_code,
                  member_name: mbr.name,
                  member_code: mbr.member_code,
                  contact_no_1: mbr.contact_no_1,
                  pending_balance: (Number(p.net_amount_due) || 0) - (Number(p.amount_paid) || 0)
                };
              });
            }
            if (cleanSql.includes('FROM dividends')) {
              if (cleanSql.includes('GROUP BY month_number')) {
                const grouped = {};
                memoryStore.dividends.forEach(d => {
                  const m = d.month_number || 1;
                  if (!grouped[m]) grouped[m] = { month_number: m, total_dividend: 0 };
                  grouped[m].total_dividend += (Number(d.dividend_amount) || 0);
                });
                return Object.values(grouped);
              }

              let filtered = [...memoryStore.dividends];

              let pIdx = 0;
              if (cleanSql.includes('d.scheme_id = ?') || cleanSql.includes('scheme_id = ?')) {
                const schVal = params[pIdx++];
                if (schVal != null && schVal !== '') {
                  filtered = filtered.filter(d => d && (d.scheme_id === Number(schVal) || String(d.scheme_id) === String(schVal)));
                }
              }
              if (cleanSql.includes('d.member_id = ?') || cleanSql.includes('member_id = ?')) {
                const mbrVal = params[pIdx++];
                if (mbrVal != null && mbrVal !== '') {
                  filtered = filtered.filter(d => d && (d.member_id === Number(mbrVal) || String(d.member_id) === String(mbrVal)));
                }
              }
              if (cleanSql.includes('d.month_number = ?') || cleanSql.includes('month_number = ?')) {
                const mVal = params[pIdx++];
                if (mVal != null && mVal !== '') {
                  filtered = filtered.filter(d => d && Number(d.month_number) === Number(mVal));
                }
              }

              return filtered.map(d => {
                const sch = memoryStore.chit_schemes.find(s => s && (s.id === d.scheme_id || String(s.id) === String(d.scheme_id))) || {};
                const mbr = memoryStore.members.find(m => m && (m.id === d.member_id || String(m.id) === String(d.member_id))) || {};
                const auc = memoryStore.auctions.find(a => a && (a.id === d.auction_id || String(a.id) === String(d.auction_id))) || {};
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
              return memoryStore.kyc_documents.filter(doc => doc && doc.member_id === Number(params[0]));
            }
            if (cleanSql.includes('FROM chit_enrollments')) {
              let filtered = [...memoryStore.chit_enrollments];
              let pIdx = 0;
              if (cleanSql.includes('member_id = ?') || cleanSql.includes('ce.member_id = ?')) {
                const mbrVal = params[pIdx++];
                if (mbrVal != null && mbrVal !== '') {
                  filtered = filtered.filter(ce => ce && (ce.member_id === Number(mbrVal) || String(ce.member_id) === String(mbrVal)));
                }
              }
              if (cleanSql.includes('scheme_id = ?') || cleanSql.includes('ce.scheme_id = ?')) {
                const schVal = params[pIdx++];
                if (schVal != null && schVal !== '') {
                  filtered = filtered.filter(ce => ce && (ce.scheme_id === Number(schVal) || String(schVal) === String(ce.scheme_id)));
                }
              }
              return filtered.map(ce => {
                const sch = memoryStore.chit_schemes.find(s => s && (s.id === ce.scheme_id || String(s.id) === String(ce.scheme_id))) || {};
                const m = memoryStore.members.find(mbr => mbr && (mbr.id === ce.member_id || String(mbr.id) === String(ce.member_id))) || {};
                return {
                  ...ce,
                  enrollment_id: ce.id,
                  scheme_id: sch.id,
                  scheme_code: sch.scheme_code,
                  scheme_name: sch.scheme_name,
                  total_chit_value: sch.total_chit_value,
                  monthly_contribution: sch.monthly_contribution,
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
          } catch (e) {
            console.error('JS Engine ALL error:', e);
          }
          return [];
        },
        run: (...params) => {
          try {
            if (cleanSql.includes('INSERT INTO users')) {
              const id = autoId.users++;
              const uObj = { id, name: params[0], email: params[1], password_hash: params[2], role: params[3], created_at: params[4] };
              memoryStore.users.push(uObj);
              supabase.from('users').insert([{ name: params[0], email: params[1], password_hash: params[2], role: params[3] }]).then(r => { if(r.error) console.error('Supabase user insert:', r.error); });
              return { lastInsertRowid: id };
            }
            if (cleanSql.includes('INSERT INTO members')) {
              const id = autoId.members++;
              const mObj = {
                id, member_code: params[0], name: params[1], email: params[2],
                contact_no_1: params[3], contact_no_2: params[4], aadhaar_no: params[5],
                kyc_status: params[6] || 'Verified', chit_status: params[7] || 'Active',
                created_at: params[8] || new Date().toISOString(), updated_at: params[9] || new Date().toISOString()
              };
              memoryStore.members.unshift(mObj);
              supabase.from('members').insert([{
                member_code: params[0], name: params[1], email: params[2],
                contact_no_1: params[3], contact_no_2: params[4], aadhaar_no: params[5],
                kyc_status: params[6] || 'Verified', chit_status: params[7] || 'Active'
              }]).then(r => { if(r.error) console.error('Supabase member insert:', r.error); });
              return { lastInsertRowid: id };
            }
            if (cleanSql.includes('INSERT INTO kyc_documents')) {
              const id = autoId.kyc_documents++;
              const docObj = {
                id, member_id: params[0], document_type: params[1], file_name: params[2],
                original_name: params[3], file_path: params[4], mime_type: params[5],
                file_size: params[6], uploaded_at: params[7]
              };
              memoryStore.kyc_documents.push(docObj);
              supabase.from('kyc_documents').insert([{
                member_id: params[0], document_type: params[1], file_name: params[2],
                original_name: params[3], file_path: params[4], mime_type: params[5],
                file_size: params[6]
              }]).then(r => { if(r.error) console.error('Supabase kyc insert:', r.error); });
              return { lastInsertRowid: id };
            }
            if (cleanSql.includes('INSERT INTO chit_schemes')) {
              const id = autoId.chit_schemes++;
              const schObj = {
                id, scheme_code: params[0], scheme_name: params[1], total_chit_value: params[2],
                duration_months: params[3], number_of_members: params[4], monthly_contribution: params[5],
                foreman_commission_percent: params[6], foreman_commission_amount: params[7],
                start_date: params[8], end_date: params[9], status: 'Active', created_at: params[10]
              };
              memoryStore.chit_schemes.unshift(schObj);
              supabase.from('chit_schemes').insert([{
                scheme_code: params[0], scheme_name: params[1], total_chit_value: params[2],
                duration_months: params[3], number_of_members: params[4], monthly_contribution: params[5],
                foreman_commission_percent: params[6], foreman_commission_amount: params[7],
                start_date: params[8], end_date: params[9], status: 'Active'
              }]).then(r => { if(r.error) console.error('Supabase scheme insert:', r.error); });
              return { lastInsertRowid: id };
            }
            if (cleanSql.includes('INSERT INTO chit_enrollments')) {
              const id = autoId.chit_enrollments++;
              const enrObj = { id, scheme_id: params[0], member_id: params[1], ticket_number: params[2], enrolled_at: params[3], status: 'Active' };
              memoryStore.chit_enrollments.push(enrObj);
              supabase.from('chit_enrollments').insert([{
                scheme_id: params[0], member_id: params[1], ticket_number: params[2], status: 'Active'
              }]).then(r => { if(r.error) console.error('Supabase enrollment insert:', r.error); });
              return { lastInsertRowid: id };
            }
            if (cleanSql.includes('INSERT INTO auctions')) {
              const id = autoId.auctions++;
              const aucObj = {
                id, scheme_id: params[0], month_number: params[1], auction_date: params[2],
                winning_member_id: params[3], winning_ticket_number: params[4], winning_bid_discount: params[5],
                foreman_commission: params[6], winner_payout: params[7], dividend_pool: params[8],
                dividend_per_member: params[9], next_month_payable: params[10], notes: params[11], created_at: params[12]
              };
              memoryStore.auctions.unshift(aucObj);
              supabase.from('auctions').insert([{
                scheme_id: params[0], month_number: params[1], auction_date: params[2],
                winning_member_id: params[3], winning_ticket_number: params[4], winning_bid_discount: params[5],
                foreman_commission: params[6], winner_payout: params[7], dividend_pool: params[8],
                dividend_per_member: params[9], next_month_payable: params[10], notes: params[11]
              }]).then(r => { if(r.error) console.error('Supabase auction insert:', r.error); });
              return { lastInsertRowid: id };
            }
            if (cleanSql.includes('INSERT INTO monthly_payments')) {
              let schId, mbrId, tckNo, mNum, baseVal, divVal, netVal, amtPaid, stat, nts, crtAt;
              if (params.length >= 9 && cleanSql.includes('ticket_number')) {
                schId = Number(params[0]);
                mbrId = Number(params[1]);
                tckNo = Number(params[2]);
                mNum = Number(params[3]);
                baseVal = Number(params[4]);
                divVal = Number(params[5]);
                netVal = Number(params[6]);
                if (cleanSql.includes("0, 'Pending'")) {
                  amtPaid = 0;
                  stat = 'Pending';
                  nts = params[7] || '';
                  crtAt = params[8] || new Date().toISOString();
                } else {
                  amtPaid = Number(params[7]) || 0;
                  stat = params[8] || 'Pending';
                  nts = params[9] || '';
                  crtAt = params[10] || new Date().toISOString();
                }
              } else {
                schId = Number(params[0]);
                mbrId = Number(params[1]);
                tckNo = 1;
                mNum = Number(params[2]);
                baseVal = Number(params[3]);
                divVal = Number(params[4]);
                netVal = Number(params[5]);
                amtPaid = Number(params[6]) || 0;
                stat = params[7] || 'Pending';
                nts = params[8] || '';
                crtAt = params[9] || new Date().toISOString();
              }

              const existing = memoryStore.monthly_payments.find(p => p && p.scheme_id === schId && p.member_id === mbrId && p.month_number === mNum && (p.ticket_number || 1) === tckNo);
              if (existing) {
                existing.dividend_applied = divVal;
                existing.net_amount_due = netVal;
                existing.base_contribution = baseVal;
                supabase.from('monthly_payments').update({ dividend_applied: divVal, net_amount_due: netVal, base_contribution: baseVal }).eq('id', existing.id).then(r => { if(r.error) console.error('Supabase payment update:', r.error); });
                return { lastInsertRowid: existing.id };
              }

              const id = autoId.monthly_payments++;
              const pmtObj = {
                id, scheme_id: schId, member_id: mbrId, ticket_number: tckNo, month_number: mNum,
                base_contribution: baseVal, dividend_applied: divVal, net_amount_due: netVal,
                amount_paid: amtPaid, status: stat, notes: nts, created_at: crtAt
              };
              memoryStore.monthly_payments.unshift(pmtObj);
              supabase.from('monthly_payments').insert([{
                scheme_id: schId, member_id: mbrId, ticket_number: tckNo, month_number: mNum,
                base_contribution: baseVal, dividend_applied: divVal, net_amount_due: netVal,
                amount_paid: amtPaid, status: stat, notes: nts
              }]).then(r => { if(r.error) console.error('Supabase payment insert:', r.error); });
              return { lastInsertRowid: id };
            }
            if (cleanSql.includes('INSERT INTO dividends')) {
              let aucId, schId, mbrId, tckNo, mNum, divAmt, crtAt;
              if (params.length >= 6 && cleanSql.includes('ticket_number')) {
                aucId = Number(params[0]);
                schId = Number(params[1]);
                mbrId = Number(params[2]);
                tckNo = Number(params[3]);
                mNum = Number(params[4]);
                divAmt = Number(params[5]);
                crtAt = params[6] || new Date().toISOString();
              } else {
                aucId = Number(params[0]);
                schId = Number(params[1]);
                mbrId = Number(params[2]);
                tckNo = 1;
                mNum = Number(params[3]);
                divAmt = Number(params[4]);
                crtAt = params[5] || new Date().toISOString();
              }
              const id = autoId.dividends++;
              const divObj = {
                id, auction_id: aucId, scheme_id: schId, member_id: mbrId, ticket_number: tckNo,
                month_number: mNum, dividend_amount: divAmt, created_at: crtAt
              };
              memoryStore.dividends.unshift(divObj);
              supabase.from('dividends').insert([{
                auction_id: aucId, scheme_id: schId, member_id: mbrId, ticket_number: tckNo,
                month_number: mNum, dividend_amount: divAmt
              }]).then(r => { if(r.error) console.error('Supabase dividend insert:', r.error); });
              return { lastInsertRowid: id };
            }
            if (cleanSql.includes('INSERT INTO audit_logs')) {
              const id = autoId.audit_logs++;
              const audObj = { id, user_id: params[0], user_name: params[1], action: params[2], target: params[3], details: params[4], timestamp: params[5] };
              memoryStore.audit_logs.unshift(audObj);
              supabase.from('audit_logs').insert([{ user_id: params[0], user_name: params[1], action: params[2], target: params[3], details: params[4] }]).then(r => { if(r.error) console.error('Supabase audit insert:', r.error); });
              return { lastInsertRowid: id };
            }
            if (cleanSql.includes('UPDATE monthly_payments')) {
              const pId = params[params.length - 1];
              const item = memoryStore.monthly_payments.find(p => p && (p.id === Number(pId) || String(p.id) === String(pId)));
              if (item) {
                item.amount_paid = Number(params[0]) || 0;
                item.payment_date = params[1] || new Date().toISOString().split('T')[0];
                item.payment_mode = params[2] || 'UPI';
                item.reference_no = params[3];
                item.status = params[4];
                item.notes = params[5] || '';
                if (params.length >= 11) {
                  item.proof_image_data = params[6] || item.proof_image_data;
                  item.bank_name = params[7] || item.bank_name;
                  item.cheque_no = params[8] || item.cheque_no;
                  item.cheque_date = params[9] || item.cheque_date;
                }
                supabase.from('monthly_payments').update({
                  amount_paid: item.amount_paid,
                  payment_date: item.payment_date,
                  payment_mode: item.payment_mode,
                  reference_no: item.reference_no,
                  status: item.status,
                  notes: item.notes,
                  bank_name: item.bank_name,
                  cheque_no: item.cheque_no,
                  cheque_date: item.cheque_date
                }).eq('id', item.id).then(r => { if(r.error) console.error('Supabase payment update error:', r.error); });
              }
              return { changes: 1 };
            }
            if (cleanSql.includes('UPDATE chit_schemes')) {
              const schId = params[params.length - 1];
              const item = memoryStore.chit_schemes.find(s => s.id === Number(schId) || String(s.id) === String(schId));
              if (item) {
                // SET scheme_name=?,total_chit_value=?,duration_months=?,number_of_members=?,monthly_contribution=?,foreman_commission_percent=?,start_date=?,end_date=?,status=?,updated_at=?
                if (params.length >= 11) {
                  item.scheme_name = params[0]; item.total_chit_value = params[1];
                  item.duration_months = params[2]; item.number_of_members = params[3];
                  item.monthly_contribution = params[4]; item.foreman_commission_percent = params[5];
                  item.start_date = params[6]; item.end_date = params[7];
                  item.status = params[8]; item.updated_at = params[9];
                }
                supabase.from('chit_schemes').update({
                  scheme_name: item.scheme_name, total_chit_value: item.total_chit_value,
                  duration_months: item.duration_months, number_of_members: item.number_of_members,
                  monthly_contribution: item.monthly_contribution, foreman_commission_percent: item.foreman_commission_percent,
                  start_date: item.start_date, end_date: item.end_date, status: item.status
                }).eq('id', item.id).then(r => { if(r.error) console.error('Supabase scheme update:', r.error); });
              }
              return { changes: 1 };
            }
            if (cleanSql.includes('UPDATE members')) {
              const mId = params[params.length - 1];
              const item = memoryStore.members.find(m => m.id === Number(mId) || String(m.id) === String(mId));
              if (item) {
                if (params.length >= 9) {
                  // SET member_code=?,name=?,email=?,contact_no_1=?,contact_no_2=?,aadhaar_no=?,kyc_status=?,chit_status=?,updated_at=?
                  item.member_code = params[0]; item.name = params[1]; item.email = params[2];
                  item.contact_no_1 = params[3]; item.contact_no_2 = params[4];
                  item.aadhaar_no = params[5]; item.kyc_status = params[6];
                  item.chit_status = params[7]; item.updated_at = params[8];
                } else if (params.length >= 8) {
                  item.name = params[0]; item.email = params[1]; item.contact_no_1 = params[2];
                  item.contact_no_2 = params[3]; item.aadhaar_no = params[4]; item.kyc_status = params[5];
                  item.chit_status = params[6];
                } else {
                  item.chit_status = 'Deactivated'; item.kyc_status = 'Inactive';
                }
                // Persist to Supabase
                const updatePayload = {};
                if (item.member_code !== undefined) updatePayload.member_code = item.member_code;
                if (item.name !== undefined) updatePayload.name = item.name;
                if (item.email !== undefined) updatePayload.email = item.email;
                if (item.contact_no_1 !== undefined) updatePayload.contact_no_1 = item.contact_no_1;
                if (item.contact_no_2 !== undefined) updatePayload.contact_no_2 = item.contact_no_2;
                if (item.aadhaar_no !== undefined) updatePayload.aadhaar_no = item.aadhaar_no;
                if (item.kyc_status !== undefined) updatePayload.kyc_status = item.kyc_status;
                if (item.chit_status !== undefined) updatePayload.chit_status = item.chit_status;
                supabase.from('members').update(updatePayload).eq('id', item.id).then(r => { if(r.error) console.error('Supabase member update:', r.error); });
              }
              return { changes: 1 };
            }
            if (cleanSql.includes('DELETE FROM kyc_documents WHERE member_id = ?')) {
              const mId = Number(params[0]);
              memoryStore.kyc_documents = memoryStore.kyc_documents.filter(d => d && d.member_id !== mId);
              supabase.from('kyc_documents').delete().eq('member_id', mId).then(r => { if(r.error) console.error('Supabase kyc delete:', r.error); });
              return { changes: 1 };
            }
            if (cleanSql.includes('DELETE FROM chit_enrollments WHERE member_id = ?')) {
              const mId = Number(params[0]);
              memoryStore.chit_enrollments = memoryStore.chit_enrollments.filter(e => e && e.member_id !== mId);
              supabase.from('chit_enrollments').delete().eq('member_id', mId).then(r => { if(r.error) console.error('Supabase enrollment delete:', r.error); });
              return { changes: 1 };
            }
            if (cleanSql.includes('DELETE FROM monthly_payments WHERE member_id = ?')) {
              const mId = Number(params[0]);
              memoryStore.monthly_payments = memoryStore.monthly_payments.filter(p => p && p.member_id !== mId);
              supabase.from('monthly_payments').delete().eq('member_id', mId).then(r => { if(r.error) console.error('Supabase payment delete:', r.error); });
              return { changes: 1 };
            }
            if (cleanSql.includes('DELETE FROM dividends WHERE member_id = ?')) {
              const mId = Number(params[0]);
              memoryStore.dividends = memoryStore.dividends.filter(d => d && d.member_id !== mId);
              supabase.from('dividends').delete().eq('member_id', mId).then(r => { if(r.error) console.error('Supabase dividend delete:', r.error); });
              return { changes: 1 };
            }
            if (cleanSql.includes('DELETE FROM members WHERE id = ?')) {
              const mId = params[0];
              memoryStore.members = memoryStore.members.filter(m => m && m.id !== Number(mId) && String(m.id) !== String(mId) && m.member_code !== String(mId));
              supabase.from('members').delete().eq('id', Number(mId) || mId).then(r => { if(r.error) console.error('Supabase member delete:', r.error); });
              return { changes: 1 };
            }
            if (cleanSql.includes('DELETE FROM chit_enrollments WHERE scheme_id = ?')) {
              const schId = Number(params[0]);
              memoryStore.chit_enrollments = memoryStore.chit_enrollments.filter(e => e && e.scheme_id !== schId);
              supabase.from('chit_enrollments').delete().eq('scheme_id', schId).then(r => { if(r.error) console.error('Supabase enrollment delete:', r.error); });
              return { changes: 1 };
            }
            if (cleanSql.includes('DELETE FROM auctions WHERE scheme_id = ?')) {
              const schId = Number(params[0]);
              memoryStore.auctions = memoryStore.auctions.filter(a => a && a.scheme_id !== schId);
              supabase.from('auctions').delete().eq('scheme_id', schId).then(r => { if(r.error) console.error('Supabase auction delete:', r.error); });
              return { changes: 1 };
            }
            if (cleanSql.includes('DELETE FROM monthly_payments WHERE scheme_id = ?')) {
              const schId = Number(params[0]);
              memoryStore.monthly_payments = memoryStore.monthly_payments.filter(p => p && p.scheme_id !== schId);
              supabase.from('monthly_payments').delete().eq('scheme_id', schId).then(r => { if(r.error) console.error('Supabase payment delete:', r.error); });
              return { changes: 1 };
            }
            if (cleanSql.includes('DELETE FROM dividends WHERE scheme_id = ?')) {
              const schId = Number(params[0]);
              memoryStore.dividends = memoryStore.dividends.filter(d => d && d.scheme_id !== schId);
              supabase.from('dividends').delete().eq('scheme_id', schId).then(r => { if(r.error) console.error('Supabase dividend delete:', r.error); });
              return { changes: 1 };
            }
            if (cleanSql.includes('DELETE FROM chit_schemes WHERE id = ?')) {
              const schId = Number(params[0]);
              memoryStore.chit_schemes = memoryStore.chit_schemes.filter(s => s && s.id !== schId);
              supabase.from('chit_schemes').delete().eq('id', schId).then(r => { if(r.error) console.error('Supabase scheme delete:', r.error); });
              return { changes: 1 };
            }
            if (cleanSql.includes('DELETE FROM auctions WHERE id = ?')) {
              const aucId = Number(params[0]);
              memoryStore.auctions = memoryStore.auctions.filter(a => a && a.id !== aucId && String(a.id) !== String(aucId));
              supabase.from('auctions').delete().eq('id', aucId).then(r => { if(r.error) console.error('Supabase auction delete:', r.error); });
              return { changes: 1 };
            }
            if (cleanSql.includes('DELETE FROM dividends WHERE auction_id = ?')) {
              const aucId = Number(params[0]);
              memoryStore.dividends = memoryStore.dividends.filter(d => d && d.auction_id !== aucId && String(d.auction_id) !== String(aucId));
              supabase.from('dividends').delete().eq('auction_id', aucId).then(r => { if(r.error) console.error('Supabase dividend delete:', r.error); });
              return { changes: 1 };
            }
            if (cleanSql.includes('DELETE FROM monthly_payments WHERE scheme_id = ? AND month_number = ?')) {
              const schId = Number(params[0]);
              const mNum = Number(params[1]);
              memoryStore.monthly_payments = memoryStore.monthly_payments.filter(p => !(p && (p.scheme_id === schId || String(p.scheme_id) === String(schId)) && p.month_number === mNum));
              supabase.from('monthly_payments').delete().eq('scheme_id', schId).eq('month_number', mNum).then(r => { if(r.error) console.error('Supabase payment delete:', r.error); });
              return { changes: 1 };
            }
            if (cleanSql.includes('UPDATE auctions')) {
              const aucId = params[params.length - 1];
              const item = memoryStore.auctions.find(a => a.id === Number(aucId) || String(a.id) === String(aucId));
              if (item) {
                if (cleanSql.includes('dividend_per_member')) {
                  item.dividend_per_member = params[0];
                  item.next_month_payable = params[1];
                  supabase.from('auctions').update({ dividend_per_member: item.dividend_per_member, next_month_payable: item.next_month_payable }).eq('id', item.id).then(r => { if(r.error) console.error('Supabase auction update:', r.error); });
                } else if (params.length >= 10) {
                  item.winning_member_id = params[0];
                  item.winning_ticket_number = params[1];
                  item.winning_bid_discount = params[2];
                  item.foreman_commission = params[3];
                  item.winner_payout = params[4];
                  item.dividend_pool = params[5];
                  item.dividend_per_member = params[6];
                  item.next_month_payable = params[7];
                  item.auction_date = params[8];
                  item.notes = params[9];
                  supabase.from('auctions').update({
                    winning_member_id: item.winning_member_id,
                    winning_ticket_number: item.winning_ticket_number,
                    winning_bid_discount: item.winning_bid_discount,
                    foreman_commission: item.foreman_commission,
                    winner_payout: item.winner_payout,
                    dividend_pool: item.dividend_pool,
                    dividend_per_member: item.dividend_per_member,
                    next_month_payable: item.next_month_payable,
                    auction_date: item.auction_date,
                    notes: item.notes
                  }).eq('id', item.id).then(r => { if(r.error) console.error('Supabase auction update:', r.error); });
                }
              }
              return { changes: 1 };
            }
            if (cleanSql.includes('UPDATE dividends')) {
              const aucId = Number(params[1]);
              const divAmt = params[0];
              memoryStore.dividends.filter(d => d && (d.auction_id === aucId || String(d.auction_id) === String(aucId))).forEach(d => { d.dividend_amount = divAmt; });
              supabase.from('dividends').update({ dividend_amount: divAmt }).eq('auction_id', aucId).then(r => { if(r.error) console.error('Supabase dividend update:', r.error); });
              return { changes: 1 };
            }
            if (cleanSql.includes('UPDATE monthly_payments') && cleanSql.includes('WHERE scheme_id = ? AND month_number = ?')) {
              const divApp = params[0];
              const netDue = params[1];
              const schId = Number(params[2]);
              const mNum = Number(params[3]);
              memoryStore.monthly_payments.filter(p => p && (p.scheme_id === schId || String(p.scheme_id) === String(schId)) && p.month_number === mNum).forEach(p => {
                p.dividend_applied = divApp;
                p.net_amount_due = netDue;
              });
              supabase.from('monthly_payments').update({ dividend_applied: divApp, net_amount_due: netDue }).eq('scheme_id', schId).eq('month_number', mNum).then(r => { if(r.error) console.error('Supabase payment update:', r.error); });
              return { changes: 1 };
            }
            if (cleanSql.includes('DELETE FROM chit_enrollments')) {
              const enrollId = params[0];
              memoryStore.chit_enrollments = memoryStore.chit_enrollments.filter(e => e && e.id !== Number(enrollId) && String(e.id) !== String(enrollId));
              supabase.from('chit_enrollments').delete().eq('id', Number(enrollId) || enrollId).then(r => { if(r.error) console.error('Supabase enrollment delete:', r.error); });
              return { changes: 1 };
            }
          } catch (e) {
            console.error('JS Engine RUN error:', e);
          }
          return { lastInsertRowid: 1, changes: 1 };
        }
      };
    },
    transaction: (fn) => fn
  };

function seedMemoryDB(database) {
  try {
    // Only seed the admin user — no mock data
    const now = new Date().toISOString();
    const adminPasswordHash = bcrypt.hashSync('admin123', 10);
    database.prepare('INSERT INTO users').run('Admin Staff', 'admin@balajichit.com', adminPasswordHash, 'admin', now);
    console.log('Database initialized with admin user only. Ready for real data.');
  } catch (e) {
    console.error('Seed memory DB error:', e);
  }
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
        UNIQUE(scheme_id, ticket_number)
      );
      CREATE TABLE IF NOT EXISTS auctions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        scheme_id INTEGER NOT NULL,
        month_number INTEGER NOT NULL,
        auction_date TEXT NOT NULL,
        winning_member_id INTEGER NOT NULL,
        winning_ticket_number INTEGER DEFAULT 1,
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
        ticket_number INTEGER DEFAULT 1,
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
        UNIQUE(scheme_id, member_id, ticket_number, month_number)
      );
      CREATE TABLE IF NOT EXISTS dividends (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        auction_id INTEGER NOT NULL,
        scheme_id INTEGER NOT NULL,
        member_id INTEGER NOT NULL,
        ticket_number INTEGER DEFAULT 1,
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

    // Dynamic SQLite Table Migrations for Multi-Ticket Support
    try {
      // Recreate chit_enrollments if it still has old UNIQUE(scheme_id, member_id) constraint
      db.exec(`
        CREATE TABLE IF NOT EXISTS chit_enrollments_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          scheme_id INTEGER NOT NULL,
          member_id INTEGER NOT NULL,
          ticket_number INTEGER NOT NULL,
          enrolled_at TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'Active',
          UNIQUE(scheme_id, ticket_number)
        );
        INSERT OR IGNORE INTO chit_enrollments_new (id, scheme_id, member_id, ticket_number, enrolled_at, status)
        SELECT id, scheme_id, member_id, ticket_number, enrolled_at, status FROM chit_enrollments;
        DROP TABLE IF EXISTS chit_enrollments;
        ALTER TABLE chit_enrollments_new RENAME TO chit_enrollments;
      `);
    } catch (e) {}

    try {
      const pmtCols = db.prepare("PRAGMA table_info(monthly_payments)").all();
      if (!pmtCols.some(c => c.name === 'ticket_number')) {
        db.exec("ALTER TABLE monthly_payments ADD COLUMN ticket_number INTEGER DEFAULT 1");
      }
      if (!pmtCols.some(c => c.name === 'proof_image_data')) {
        db.exec("ALTER TABLE monthly_payments ADD COLUMN proof_image_data TEXT");
      }
      if (!pmtCols.some(c => c.name === 'bank_name')) {
        db.exec("ALTER TABLE monthly_payments ADD COLUMN bank_name TEXT");
      }
      if (!pmtCols.some(c => c.name === 'cheque_no')) {
        db.exec("ALTER TABLE monthly_payments ADD COLUMN cheque_no TEXT");
      }
      if (!pmtCols.some(c => c.name === 'cheque_date')) {
        db.exec("ALTER TABLE monthly_payments ADD COLUMN cheque_date TEXT");
      }
    } catch (e) {}

    try {
      const aucCols = db.prepare("PRAGMA table_info(auctions)").all();
      if (!aucCols.some(c => c.name === 'winning_ticket_number')) {
        db.exec("ALTER TABLE auctions ADD COLUMN winning_ticket_number INTEGER DEFAULT 1");
      }
      if (!aucCols.some(c => c.name === 'payout_mode')) {
        db.exec("ALTER TABLE auctions ADD COLUMN payout_mode TEXT DEFAULT 'Bank Transfer'");
      }
      if (!aucCols.some(c => c.name === 'payout_ref_no')) {
        db.exec("ALTER TABLE auctions ADD COLUMN payout_ref_no TEXT");
      }
      if (!aucCols.some(c => c.name === 'payout_bank_name')) {
        db.exec("ALTER TABLE auctions ADD COLUMN payout_bank_name TEXT");
      }
      if (!aucCols.some(c => c.name === 'payout_cheque_no')) {
        db.exec("ALTER TABLE auctions ADD COLUMN payout_cheque_no TEXT");
      }
      if (!aucCols.some(c => c.name === 'payout_cheque_date')) {
        db.exec("ALTER TABLE auctions ADD COLUMN payout_cheque_date TEXT");
      }
      if (!aucCols.some(c => c.name === 'payout_proof_image')) {
        db.exec("ALTER TABLE auctions ADD COLUMN payout_proof_image TEXT");
      }
    } catch (e) {}

    try {
      const divCols = db.prepare("PRAGMA table_info(dividends)").all();
      if (!divCols.some(c => c.name === 'ticket_number')) {
        db.exec("ALTER TABLE dividends ADD COLUMN ticket_number INTEGER DEFAULT 1");
      }
    } catch (e) {}

    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
    if (userCount === 0) {
      seedMemoryDB(db);
    }
  }
  initDB();
}

module.exports = db;

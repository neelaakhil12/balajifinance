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
      if (!memoryStore.users.some(u => u && u.email && u.email.toLowerCase() === adminEmail)) {
        memoryStore.users.push(defaultAdminUser);
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
            if (cleanSql.includes('FROM chit_enrollments')) {
              const schId = params[0] ? Number(params[0]) : null;
              const cnt = schId ? memoryStore.chit_enrollments.filter(e => e && e.scheme_id === schId).length : memoryStore.chit_enrollments.length;
              return { cnt, total: cnt, count: cnt };
            }
            if (cleanSql.includes('FROM auctions')) {
              const schId = params[0] ? Number(params[0]) : null;
              const cnt = schId ? memoryStore.auctions.filter(a => a && a.scheme_id === schId).length : memoryStore.auctions.length;
              return { cnt, total: cnt, count: cnt };
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
                .reduce((acc, s) => acc + (s.total_chit_value || 0), 0);
              return { cnt, count: cnt, total: totalVal };
            }
            if (cleanSql.includes('FROM members') && cleanSql.includes('COUNT')) {
              const cnt = memoryStore.members.filter(m => m && m.chit_status !== 'Deactivated').length;
              return { cnt, count: cnt };
            }
            if (cleanSql.includes('SUM(total_chit_value)')) {
              const total = memoryStore.chit_schemes.filter(s => s && s.status === 'Active').reduce((acc, s) => acc + (s.total_chit_value || 0), 0);
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
                .filter(p => p && ['Pending', 'Partially Paid', 'Overdue'].includes(p.status))
                .reduce((acc, p) => acc + ((p.net_amount_due || 0) - (p.amount_paid || 0)), 0);
              return { total };
            }
            if (cleanSql.includes('SELECT * FROM kyc_documents WHERE id = ? AND member_id = ?')) {
              return memoryStore.kyc_documents.find(d => d && d.id === Number(params[1]) && d.member_id === Number(params[0]));
            }
            if (cleanSql.includes('SELECT id FROM chit_enrollments WHERE scheme_id = ? AND member_id = ?')) {
              return memoryStore.chit_enrollments.find(e => e && e.scheme_id === Number(params[0]) && e.member_id === Number(params[1]));
            }
            if (cleanSql.includes('SELECT id FROM chit_enrollments WHERE scheme_id = ? AND ticket_number = ?')) {
              const schParam = params[0];
              const tckParam = Number(params[1]);
              return memoryStore.chit_enrollments.find(e => e && (e.scheme_id === Number(schParam) || String(e.scheme_id) === String(schParam)) && Number(e.ticket_number) === tckParam);
            }
            if (cleanSql.includes('SELECT id FROM auctions WHERE scheme_id = ? AND month_number = ?')) {
              const schId = params[0];
              return memoryStore.auctions.find(a => a && (a.scheme_id === Number(schId) || String(a.scheme_id) === String(schId)) && a.month_number === Number(params[1]));
            }
            if (cleanSql.includes('winning_ticket_number') && cleanSql.includes('winning_member_id') && cleanSql.includes('auctions')) {
              const schId = params[0]; const ticketNo = params[1]; const memberId = params[2];
              return memoryStore.auctions.find(a => a && (a.scheme_id === Number(schId) || String(a.scheme_id) === String(schId)) && Number(a.winning_ticket_number) === Number(ticketNo) && Number(a.winning_member_id) === Number(memberId));
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
              return [...memoryStore.members];
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
                  grouped[m].collected += (p.amount_paid || 0);
                  grouped[m].target += (p.net_amount_due || 0);
                });
                return Object.values(grouped);
              }
              let filtered = [...memoryStore.monthly_payments];
              if (params.length >= 1 && params[0] != null) {
                const schId = Number(params[0]);
                filtered = filtered.filter(p => p && p.scheme_id === schId);
              }
              if (params.length >= 2 && params[1] != null) {
                const mbrId = Number(params[1]);
                filtered = filtered.filter(p => p && p.member_id === mbrId);
              }
              return filtered.map(p => {
                const sch = memoryStore.chit_schemes.find(s => s && s.id === p.scheme_id) || {};
                const mbr = memoryStore.members.find(m => m && m.id === p.member_id) || {};
                return {
                  ...p,
                  scheme_name: sch.scheme_name,
                  scheme_code: sch.scheme_code,
                  member_name: mbr.name,
                  member_code: mbr.member_code,
                  contact_no_1: mbr.contact_no_1,
                  pending_balance: (p.net_amount_due || 0) - (p.amount_paid || 0)
                };
              });
            }
            if (cleanSql.includes('FROM dividends')) {
              if (cleanSql.includes('GROUP BY month_number')) {
                const grouped = {};
                memoryStore.dividends.forEach(d => {
                  const m = d.month_number || 1;
                  if (!grouped[m]) grouped[m] = { month_number: m, total_dividend: 0 };
                  grouped[m].total_dividend += (d.dividend_amount || 0);
                });
                return Object.values(grouped);
              }
              return memoryStore.dividends.map(d => {
                const sch = memoryStore.chit_schemes.find(s => s && s.id === d.scheme_id) || {};
                const mbr = memoryStore.members.find(m => m && m.id === d.member_id) || {};
                const auc = memoryStore.auctions.find(a => a && a.id === d.auction_id) || {};
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
              return memoryStore.chit_enrollments
                .filter(ce => ce && ce.scheme_id === Number(params[0]))
                .map(ce => {
                  const m = memoryStore.members.find(mbr => mbr && mbr.id === ce.member_id) || {};
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
                winning_member_id: params[3], winning_bid_discount: params[4], foreman_commission: params[5],
                winner_payout: params[6], dividend_pool: params[7], dividend_per_member: params[8],
                next_month_payable: params[9], notes: params[10], created_at: params[11]
              };
              memoryStore.auctions.unshift(aucObj);
              supabase.from('auctions').insert([{
                scheme_id: params[0], month_number: params[1], auction_date: params[2],
                winning_member_id: params[3], winning_bid_discount: params[4], foreman_commission: params[5],
                winner_payout: params[6], dividend_pool: params[7], dividend_per_member: params[8],
                next_month_payable: params[9], notes: params[10]
              }]).then(r => { if(r.error) console.error('Supabase auction insert:', r.error); });
              return { lastInsertRowid: id };
            }
            if (cleanSql.includes('INSERT INTO monthly_payments')) {
              const existing = memoryStore.monthly_payments.find(p => p && p.scheme_id === Number(params[0]) && p.member_id === Number(params[1]) && p.month_number === Number(params[2]));
              if (existing) {
                existing.dividend_applied = params[4];
                existing.net_amount_due = params[5];
                return { lastInsertRowid: existing.id };
              }
              const id = autoId.monthly_payments++;
              const pmtObj = {
                id, scheme_id: params[0], member_id: params[1], month_number: params[2],
                base_contribution: params[3], dividend_applied: params[4], net_amount_due: params[5],
                amount_paid: params[6] || 0, status: params[7] || 'Pending', notes: params[8] || '', created_at: params[9]
              };
              memoryStore.monthly_payments.unshift(pmtObj);
              supabase.from('monthly_payments').insert([{
                scheme_id: params[0], member_id: params[1], month_number: params[2],
                base_contribution: params[3], dividend_applied: params[4], net_amount_due: params[5],
                amount_paid: params[6] || 0, status: params[7] || 'Pending', notes: params[8] || ''
              }]).then(r => { if(r.error) console.error('Supabase payment insert:', r.error); });
              return { lastInsertRowid: id };
            }
            if (cleanSql.includes('INSERT INTO dividends')) {
              const id = autoId.dividends++;
              const divObj = {
                id, auction_id: params[0], scheme_id: params[1], member_id: params[2],
                month_number: params[3], dividend_amount: params[4], created_at: params[5]
              };
              memoryStore.dividends.unshift(divObj);
              supabase.from('dividends').insert([{
                auction_id: params[0], scheme_id: params[1], member_id: params[2],
                month_number: params[3], dividend_amount: params[4]
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
              const item = memoryStore.monthly_payments.find(p => p.id === Number(pId) || String(p.id) === String(pId));
              if (item) {
                item.amount_paid = params[0];
                item.payment_date = params[1];
                item.payment_mode = params[2];
                item.reference_no = params[3];
                item.status = params[4];
                item.notes = params[5];
                // Persist to Supabase
                supabase.from('monthly_payments').update({
                  amount_paid: item.amount_paid, payment_date: item.payment_date,
                  payment_mode: item.payment_mode, reference_no: item.reference_no,
                  status: item.status, notes: item.notes
                }).eq('id', item.id).then(r => { if(r.error) console.error('Supabase payment update:', r.error); });
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
            if (cleanSql.includes('DELETE FROM chit_enrollments')) {
              const enrollId = params[0];
              memoryStore.chit_enrollments = memoryStore.chit_enrollments.filter(e => e && e.id !== Number(enrollId));
              supabase.from('chit_enrollments').delete().eq('id', Number(enrollId)).then(r => { if(r.error) console.error('Supabase enrollment delete:', r.error); });
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

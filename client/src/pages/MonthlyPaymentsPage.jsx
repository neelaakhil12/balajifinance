import React, { useState, useEffect } from 'react';
import API from '../services/api';
import Toast from '../components/common/Toast';
import Modal from '../components/common/Modal';
import { formatCurrency, formatDate } from '../utils/formatters';
import {
  CreditCard,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertCircle,
  IndianRupee,
  DollarSign
} from 'lucide-react';

export default function MonthlyPaymentsPage() {
  const [payments, setPayments] = useState([]);
  const [schemes, setSchemes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState({ type: '', message: '' });

  // Filters
  const [schemeFilter, setSchemeFilter] = useState('');
  const [monthFilter, setMonthFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  // Record Payment Modal
  const [recordModalPayment, setRecordModalPayment] = useState(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMode, setPayMode] = useState('UPI');
  const [payRefNo, setPayRefNo] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    fetchPayments();
  }, [schemeFilter, monthFilter, statusFilter, search]);

  const fetchInitialData = async () => {
    try {
      const res = await API.get('/chits');
      if (res.data.success) setSchemes(res.data.schemes);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const res = await API.get('/payments', {
        params: {
          scheme_id: schemeFilter,
          month_number: monthFilter,
          status: statusFilter,
          search: search.trim()
        }
      });
      if (res.data.success) {
        setPayments(res.data.payments);
      }
    } catch (err) {
      console.error('Fetch payments error:', err);
      setToast({ type: 'error', message: 'Failed to load payment records.' });
    } finally {
      setLoading(false);
    }
  };

  const openRecordModal = (pmt) => {
    setRecordModalPayment(pmt);
    setPayAmount(pmt.net_amount_due);
    setPayMode('UPI');
    setPayRefNo(`UPI/${Date.now().toString().slice(-6)}`);
    setPayNotes('');
  };

  const handleSavePayment = async (e) => {
    e.preventDefault();
    if (!recordModalPayment || !payAmount) return;

    try {
      setSubmitting(true);
      const res = await API.post('/payments/record', {
        payment_id: recordModalPayment.id,
        amount_paid: Number(payAmount),
        payment_mode: payMode,
        reference_no: payRefNo,
        notes: payNotes
      });

      if (res.data.success) {
        setToast({ type: 'success', message: res.data.message });
        setRecordModalPayment(null);
        fetchPayments();
      }
    } catch (err) {
      setToast({ type: 'error', message: err.response?.data?.message || 'Failed to record payment.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      
      <Toast type={toast.type} message={toast.message} onClose={() => setToast({ type: '', message: '' })} />

      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-blue-600" />
            <h2 className="text-xl font-bold text-slate-900">Monthly Member Payments</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Track member contributions, net due after auction dividend, and record payments.
          </p>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center gap-4">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by member name, code or reference number..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto flex-wrap">
          <select
            value={schemeFilter}
            onChange={(e) => setSchemeFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Chit Schemes</option>
            {schemes.map((s) => (
              <option key={s.id} value={s.id}>{s.scheme_name}</option>
            ))}
          </select>

          <select
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Months</option>
            {[...Array(20)].map((_, i) => (
              <option key={i + 1} value={i + 1}>Month {i + 1}</option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Payment Statuses</option>
            <option value="Paid">Paid</option>
            <option value="Pending">Pending</option>
            <option value="Partially Paid">Partially Paid</option>
            <option value="Overdue">Overdue</option>
          </select>
        </div>
      </div>

      {/* Payment Records Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-900 text-white font-semibold uppercase">
                <th className="p-3.5">Scheme & Month</th>
                <th className="p-3.5">Member Details</th>
                <th className="p-3.5">Base Monthly</th>
                <th className="p-3.5">Dividend Applied</th>
                <th className="p-3.5">Net Payable</th>
                <th className="p-3.5">Amount Paid</th>
                <th className="p-3.5">Payment Date & Ref</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-right">Action</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-500">
                    Loading monthly payment ledger...
                  </td>
                </tr>
              ) : payments.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-500">
                    No payment records match filter options.
                  </td>
                </tr>
              ) : (
                payments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="p-3.5">
                      <span className="font-bold text-slate-900 block">{p.scheme_name}</span>
                      <span className="font-bold text-blue-600 font-mono">Month {p.month_number}</span>
                    </td>
                    <td className="p-3.5">
                      <span className="font-bold text-slate-900 block">{p.member_name}</span>
                      <span className="text-slate-500 font-mono">{p.member_code} • {p.contact_no_1}</span>
                    </td>
                    <td className="p-3.5 text-slate-700 font-semibold">{formatCurrency(p.base_contribution)}</td>
                    <td className="p-3.5 text-emerald-600 font-semibold">-{formatCurrency(p.dividend_applied)}</td>
                    <td className="p-3.5 font-extrabold text-slate-900">{formatCurrency(p.net_amount_due)}</td>
                    <td className="p-3.5 font-bold text-emerald-700">{formatCurrency(p.amount_paid)}</td>
                    <td className="p-3.5 text-slate-600">
                      {p.payment_date ? (
                        <>
                          <span className="font-semibold block">{formatDate(p.payment_date)}</span>
                          <span className="text-[10px] text-slate-400 font-mono">{p.payment_mode} ({p.reference_no || 'No Ref'})</span>
                        </>
                      ) : (
                        <span className="text-slate-400 font-italic">Unpaid</span>
                      )}
                    </td>
                    <td className="p-3.5">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        p.status === 'Paid'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : p.status === 'Partially Paid'
                          ? 'bg-amber-100 text-amber-800 border border-amber-300'
                          : 'bg-rose-100 text-rose-800 border border-rose-300'
                      }`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="p-3.5 text-right">
                      <button
                        onClick={() => openRecordModal(p)}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg shadow-xs"
                      >
                        Record Payment
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Payment Modal */}
      {recordModalPayment && (
        <Modal
          isOpen={!!recordModalPayment}
          onClose={() => setRecordModalPayment(null)}
          title={`Record Payment for ${recordModalPayment.member_name}`}
        >
          <form onSubmit={handleSavePayment} className="space-y-4 text-xs">
            <div className="p-3 bg-slate-50 border rounded-xl space-y-1">
              <p className="text-slate-600">Scheme: <strong>{recordModalPayment.scheme_name}</strong> (Month {recordModalPayment.month_number})</p>
              <p className="text-slate-600">Base Contribution: {formatCurrency(recordModalPayment.base_contribution)}</p>
              <p className="text-emerald-700">Dividend Applied: -{formatCurrency(recordModalPayment.dividend_applied)}</p>
              <p className="text-slate-900 font-bold text-sm">Net Payable Amount Due: {formatCurrency(recordModalPayment.net_amount_due)}</p>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Amount Paid (₹) *</label>
              <input
                type="number"
                required
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                className="w-full px-3 py-2 border rounded-xl font-bold text-emerald-700"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Payment Mode *</label>
              <select
                value={payMode}
                onChange={(e) => setPayMode(e.target.value)}
                className="w-full px-3 py-2 border rounded-xl"
              >
                <option value="UPI">UPI / GPay / PhonePe</option>
                <option value="Cash">Cash</option>
                <option value="Bank Transfer">Bank Transfer (NEFT/IMPS)</option>
                <option value="Cheque">Cheque</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Reference No. / UTR</label>
              <input
                type="text"
                value={payRefNo}
                onChange={(e) => setPayRefNo(e.target.value)}
                placeholder="e.g. UPI/20260120/9981"
                className="w-full px-3 py-2 border rounded-xl font-mono"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Payment Notes</label>
              <input
                type="text"
                value={payNotes}
                onChange={(e) => setPayNotes(e.target.value)}
                placeholder="Optional remarks"
                className="w-full px-3 py-2 border rounded-xl"
              />
            </div>

            <div className="pt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRecordModalPayment(null)}
                className="px-4 py-2 border rounded-xl font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold shadow-md"
              >
                {submitting ? 'Recording...' : 'Submit Payment'}
              </button>
            </div>
          </form>
        </Modal>
      )}

    </div>
  );
}

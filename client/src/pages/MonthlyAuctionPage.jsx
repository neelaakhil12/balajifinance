import React, { useState, useEffect } from 'react';
import API from '../services/api';
import Toast from '../components/common/Toast';
import Modal from '../components/common/Modal';
import { formatCurrency, formatDate } from '../utils/formatters';
import {
  Gavel,
  Calculator,
  Calendar,
  UserCheck,
  CheckCircle2,
  AlertCircle,
  Clock,
  Layers
} from 'lucide-react';

export default function MonthlyAuctionPage() {
  const [schemes, setSchemes] = useState([]);
  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState({ type: '', message: '' });

  // Auction Form State
  const [selectedSchemeId, setSelectedSchemeId] = useState('');
  const [monthNumber, setMonthNumber] = useState(1);
  const [auctionDate, setAuctionDate] = useState(new Date().toISOString().split('T')[0]);
  const [winningMemberId, setWinningMemberId] = useState('');
  const [winningBidDiscount, setWinningBidDiscount] = useState('');
  const [notes, setNotes] = useState('');

  // Scheme Enrolled Members & Live Calculation Preview
  const [schemeDetails, setSchemeDetails] = useState(null);
  const [liveCalc, setLiveCalc] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const [schRes, aucRes] = await Promise.all([
        API.get('/chits?status=Active'),
        API.get('/auctions')
      ]);
      if (schRes.data.success) setSchemes(schRes.data.schemes);
      if (aucRes.data.success) setAuctions(aucRes.data.auctions);
    } catch (err) {
      console.error('Fetch auction data failed:', err);
      setToast({ type: 'error', message: 'Failed to load schemes or auction history.' });
    } finally {
      setLoading(false);
    }
  };

  // When scheme selection changes, load enrolled members
  useEffect(() => {
    if (selectedSchemeId) {
      fetchSchemeMembers(selectedSchemeId);
    } else {
      setSchemeDetails(null);
    }
  }, [selectedSchemeId]);

  const fetchSchemeMembers = async (schId) => {
    try {
      const res = await API.get(`/chits/${schId}`);
      if (res.data.success) {
        setSchemeDetails(res.data);
        // Default month number to completed auctions count + 1
        const nextMonth = res.data.auctions.length + 1;
        setMonthNumber(nextMonth);
      }
    } catch (err) {
      console.error('Fetch scheme details failed:', err);
    }
  };

  // Live Server Financial Calculation Preview Trigger
  useEffect(() => {
    if (selectedSchemeId && winningBidDiscount !== '' && Number(winningBidDiscount) >= 0) {
      calculateFinancialsPreview();
    } else {
      setLiveCalc(null);
    }
  }, [selectedSchemeId, winningBidDiscount]);

  const calculateFinancialsPreview = async () => {
    try {
      const res = await API.post('/auctions/calculate', {
        scheme_id: selectedSchemeId,
        auction_discount: Number(winningBidDiscount)
      });
      if (res.data.success) {
        setLiveCalc(res.data.calculations);
      }
    } catch (err) {
      setLiveCalc(null);
    }
  };

  const handleRecordAuction = async (e) => {
    e.preventDefault();
    if (!selectedSchemeId || !winningMemberId || winningBidDiscount === '') {
      setToast({ type: 'error', message: 'Please complete all required auction fields.' });
      return;
    }

    try {
      setSubmitting(true);
      const res = await API.post('/auctions', {
        scheme_id: selectedSchemeId,
        month_number: Number(monthNumber),
        auction_date: auctionDate,
        winning_member_id: winningMemberId,
        winning_bid_discount: Number(winningBidDiscount),
        notes
      });

      if (res.data.success) {
        setToast({ type: 'success', message: res.data.message });
        // Reset form inputs
        setWinningBidDiscount('');
        setWinningMemberId('');
        setNotes('');
        setLiveCalc(null);
        // Refresh auction history & scheme details
        fetchInitialData();
        if (selectedSchemeId) fetchSchemeMembers(selectedSchemeId);
      }
    } catch (err) {
      console.error('Record auction error:', err);
      setToast({ type: 'error', message: err.response?.data?.message || 'Failed to record auction.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      
      <Toast type={toast.type} message={toast.message} onClose={() => setToast({ type: '', message: '' })} />

      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Gavel className="w-5 h-5 text-blue-600" />
            <h2 className="text-xl font-bold text-slate-900">Conduct Monthly Auction</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Record monthly winning bids, calculate winner payout, foreman commission, and member dividends.
          </p>
        </div>
      </div>

      {/* Main Form & Calculation Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Form Column */}
        <form onSubmit={handleRecordAuction} className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-5">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <Calculator className="w-4 h-4 text-blue-600" />
            1. Auction Parameters & Winner Selection
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            {/* Chit Scheme Selection */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">Select Active Scheme *</label>
              <select
                required
                value={selectedSchemeId}
                onChange={(e) => setSelectedSchemeId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Choose Chit Scheme --</option>
                {schemes.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.scheme_name} ({s.scheme_code}) - {formatCurrency(s.total_chit_value)}
                  </option>
                ))}
              </select>
            </div>

            {/* Auction Month Number */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">Auction Month # *</label>
              <input
                type="number"
                min={1}
                required
                value={monthNumber}
                onChange={(e) => setMonthNumber(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Auction Date */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">Auction Date *</label>
              <input
                type="date"
                required
                value={auctionDate}
                onChange={(e) => setAuctionDate(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Winning Bid Discount Amount */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">Winning Bid Discount (₹) *</label>
              <input
                type="number"
                required
                value={winningBidDiscount}
                onChange={(e) => setWinningBidDiscount(e.target.value)}
                placeholder="e.g. 15000"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-amber-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Winning Member Dropdown */}
            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1.5">Winning Member *</label>
              <select
                required
                value={winningMemberId}
                onChange={(e) => setWinningMemberId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Select Winner from Scheme Roster --</option>
                {schemeDetails?.enrolledMembers?.map((m) => (
                  <option key={m.member_id} value={m.member_id}>
                    Ticket #{m.ticket_number}: {m.name} ({m.member_code}) - Phone: {m.contact_no_1}
                  </option>
                ))}
              </select>
            </div>

            {/* Notes */}
            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1.5">Auction Notes / Remarks</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes regarding auction bidding"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={submitting || !selectedSchemeId || !winningMemberId || winningBidDiscount === ''}
              className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-600/30 transition disabled:opacity-50 flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Saving Auction & Dividends...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>RECORD AUCTION RESULT</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Live Calculation Preview Card */}
        <div className="bg-slate-900 text-white rounded-2xl border border-slate-800 p-6 flex flex-col justify-between space-y-4">
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-blue-400 block">
              Server Financial Preview
            </span>
            <h3 className="text-lg font-bold text-white mt-1">Auction Payout & Dividends</h3>
          </div>

          {liveCalc ? (
            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700 flex justify-between">
                <span className="text-slate-400">Total Chit Value</span>
                <span className="font-extrabold text-white">{formatCurrency(liveCalc.totalChitValue)}</span>
              </div>
              <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700 flex justify-between">
                <span className="text-slate-400">Winning Bid Discount</span>
                <span className="font-extrabold text-amber-400">-{formatCurrency(liveCalc.auctionDiscount)}</span>
              </div>
              <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700 flex justify-between">
                <span className="text-slate-400">Foreman Commission</span>
                <span className="font-extrabold text-slate-300">{formatCurrency(liveCalc.foremanCommission)}</span>
              </div>
              <div className="p-3.5 bg-emerald-950/80 border border-emerald-700/80 rounded-xl flex justify-between">
                <span className="text-emerald-300 font-semibold">Final Payout to Winner</span>
                <span className="font-extrabold text-emerald-400 text-sm">{formatCurrency(liveCalc.winnerPayout)}</span>
              </div>
              <div className="p-3 bg-blue-950/80 border border-blue-800/80 rounded-xl flex justify-between">
                <span className="text-blue-300 font-semibold">Dividend Per Member</span>
                <span className="font-extrabold text-blue-400">{formatCurrency(liveCalc.dividendPerMember)}</span>
              </div>
              <div className="p-3 bg-amber-950/80 border border-amber-800/80 rounded-xl flex justify-between">
                <span className="text-amber-300 font-semibold">Next Month Contribution</span>
                <span className="font-extrabold text-amber-400">{formatCurrency(liveCalc.nextMonthPayable)}</span>
              </div>
            </div>
          ) : (
            <div className="p-6 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl">
              Select a scheme and enter a winning bid discount to view real-time financial calculations.
            </div>
          )}

          <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-400 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Decimals safe math engine verified</span>
          </div>
        </div>

      </div>

      {/* Auction History Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
          <h3 className="text-sm font-bold text-slate-900 uppercase">Auction History Records</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-900 text-white font-semibold uppercase">
                <th className="p-3.5">Scheme</th>
                <th className="p-3.5">Month</th>
                <th className="p-3.5">Date</th>
                <th className="p-3.5">Winning Member</th>
                <th className="p-3.5">Winning Discount</th>
                <th className="p-3.5">Foreman Comm.</th>
                <th className="p-3.5">Winner Payout</th>
                <th className="p-3.5">Dividend / Member</th>
                <th className="p-3.5">Next Payable</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {auctions.map((auc) => (
                <tr key={auc.id} className="hover:bg-slate-50">
                  <td className="p-3.5 font-bold text-slate-900">{auc.scheme_name}</td>
                  <td className="p-3.5 font-bold text-blue-600">Month {auc.month_number}</td>
                  <td className="p-3.5 text-slate-600">{formatDate(auc.auction_date)}</td>
                  <td className="p-3.5 font-bold text-slate-800">{auc.winner_name} ({auc.winner_code})</td>
                  <td className="p-3.5 font-semibold text-amber-600">-{formatCurrency(auc.winning_bid_discount)}</td>
                  <td className="p-3.5 text-slate-600">{formatCurrency(auc.foreman_commission)}</td>
                  <td className="p-3.5 font-extrabold text-emerald-700">{formatCurrency(auc.winner_payout)}</td>
                  <td className="p-3.5 font-bold text-blue-700">{formatCurrency(auc.dividend_per_member)}</td>
                  <td className="p-3.5 font-bold text-slate-900">{formatCurrency(auc.next_month_payable)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}

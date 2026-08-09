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
  Layers,
  Edit,
  Trash2,
  AlertTriangle
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

  // Winner Payout Payment Proof State
  const [payoutMode, setPayoutMode] = useState('Bank Transfer');
  const [payoutRefNo, setPayoutRefNo] = useState('');
  const [payoutBankName, setPayoutBankName] = useState('');
  const [payoutChequeNo, setPayoutChequeNo] = useState('');
  const [payoutChequeDate, setPayoutChequeDate] = useState(new Date().toISOString().split('T')[0]);
  const [payoutProofImage, setPayoutProofImage] = useState('');
  const [payoutPreviewUrl, setPayoutPreviewUrl] = useState('');

  // Scheme Enrolled Members & Live Calculation Preview
  const [allMembers, setAllMembers] = useState([]);
  const [schemeDetails, setSchemeDetails] = useState(null);
  const [liveCalc, setLiveCalc] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Edit & Delete Auction Modal States
  const [editModalAuction, setEditModalAuction] = useState(null);
  const [editWinnerKey, setEditWinnerKey] = useState('');
  const [editDiscount, setEditDiscount] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [deleteModalAuction, setDeleteModalAuction] = useState(null);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const [schRes, aucRes, memRes] = await Promise.all([
        API.get('/chits?status=Active'),
        API.get('/auctions'),
        API.get('/members?limit=200')
      ]);
      if (schRes.data.success) setSchemes(schRes.data.schemes);
      if (aucRes.data.success) setAuctions(aucRes.data.auctions);
      if (memRes.data.success) setAllMembers(memRes.data.members || []);
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

  // Map of ticket_key -> month_number won in this scheme (for display)
  const previousWinnersMap = React.useMemo(() => {
    const map = {};
    if (schemeDetails?.auctions) {
      schemeDetails.auctions.forEach((auc) => {
        const ticketKey = `${auc.winning_member_id}_${auc.winning_ticket_number || 1}`;
        map[ticketKey] = auc.month_number;
      });
    }
    return map;
  }, [schemeDetails]);

  // Set of member_ids who have already won any auction in this scheme
  // (Each PERSON can only win ONCE per scheme, regardless of how many tickets they hold)
  const previousWinnerMemberIds = React.useMemo(() => {
    const set = new Set();
    if (schemeDetails?.auctions) {
      schemeDetails.auctions.forEach((auc) => {
        set.add(Number(auc.winning_member_id));
      });
    }
    return set;
  }, [schemeDetails]);

  // Helper: get which month a member won (if any)
  const getMemberWonMonth = (memberId) => {
    if (!schemeDetails?.auctions) return null;
    const win = schemeDetails.auctions.find((auc) => Number(auc.winning_member_id) === Number(memberId));
    return win ? win.month_number : null;
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

  const handlePayoutProofFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPayoutProofImage(reader.result);
        setPayoutPreviewUrl(reader.result);
      };
      reader.readAsDataURL(file);
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
      const [memId, ticketNo] = winningMemberId.includes('_')
        ? winningMemberId.split('_')
        : [winningMemberId, 1];

      const res = await API.post('/auctions', {
        scheme_id: selectedSchemeId,
        month_number: Number(monthNumber),
        auction_date: auctionDate,
        winning_member_id: Number(memId),
        winning_ticket_number: Number(ticketNo),
        winning_bid_discount: Number(winningBidDiscount),
        notes,
        payout_mode: payoutMode,
        payout_ref_no: payoutRefNo,
        payout_bank_name: payoutBankName,
        payout_cheque_no: payoutChequeNo,
        payout_cheque_date: payoutChequeDate,
        payout_proof_image: payoutProofImage
      });

      if (res.data.success) {
        setToast({ type: 'success', message: res.data.message });
        // Reset form inputs
        setWinningBidDiscount('');
        setWinningMemberId('');
        setNotes('');
        setPayoutMode('Bank Transfer');
        setPayoutRefNo('');
        setPayoutBankName('');
        setPayoutChequeNo('');
        setPayoutChequeDate(new Date().toISOString().split('T')[0]);
        setPayoutProofImage('');
        setPayoutPreviewUrl('');
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

  const openEditModal = (auc) => {
    setEditModalAuction(auc);
    setEditWinnerKey(`${auc.winning_member_id}_${auc.winning_ticket_number || 1}`);
    setEditDiscount(auc.winning_bid_discount);
    setEditDate(auc.auction_date);
    setEditNotes(auc.notes || '');
  };

  const handleSaveEditAuction = async (e) => {
    e.preventDefault();
    if (!editModalAuction) return;
    try {
      const [memId, ticketNo] = editWinnerKey.includes('_')
        ? editWinnerKey.split('_')
        : [editWinnerKey, 1];

      const res = await API.put(`/auctions/${editModalAuction.id}`, {
        winning_member_id: Number(memId),
        winning_ticket_number: Number(ticketNo),
        winning_bid_discount: Number(editDiscount),
        auction_date: editDate,
        notes: editNotes
      });

      if (res.data.success) {
        setToast({ type: 'success', message: res.data.message });
        setEditModalAuction(null);
        fetchInitialData();
        if (selectedSchemeId) fetchSchemeMembers(selectedSchemeId);
      }
    } catch (err) {
      console.error('Edit auction failed:', err);
      setToast({ type: 'error', message: err.response?.data?.message || 'Failed to update auction record.' });
    }
  };

  const handleConfirmDeleteAuction = async () => {
    if (!deleteModalAuction) return;
    try {
      const res = await API.delete(`/auctions/${deleteModalAuction.id}`);
      if (res.data.success) {
        setToast({ type: 'success', message: res.data.message });
        setDeleteModalAuction(null);
        fetchInitialData();
        if (selectedSchemeId) fetchSchemeMembers(selectedSchemeId);
      }
    } catch (err) {
      console.error('Delete auction failed:', err);
      setToast({ type: 'error', message: 'Failed to delete auction record.' });
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
            {/* Scheme Selection */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">Chit Scheme *</label>
              <select
                required
                value={selectedSchemeId}
                onChange={(e) => setSelectedSchemeId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Select Active Scheme --</option>
                {schemes.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.scheme_code} - {s.scheme_name} (₹{s.total_chit_value.toLocaleString('en-IN')})
                  </option>
                ))}
              </select>
            </div>

            {/* Auction Month Number */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">Auction Month # *</label>
              <input
                type="number"
                required
                min="1"
                max={schemeDetails?.number_of_members || 50}
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

            {/* Winning Member & Ticket Dropdown */}
            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1.5">Winning Member / Ticket *</label>
              <select
                required
                value={winningMemberId}
                onChange={(e) => setWinningMemberId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {!selectedSchemeId ? (
                  <option value="">-- Select a Chit Scheme First --</option>
                ) : (
                  <>
                    <option value="">-- Select Winning Ticket for Month {monthNumber} --</option>
                    
                    {/* 1. Pre-enrolled Members Roster */}
                    {schemeDetails?.enrolledMembers?.length > 0 && (
                      <optgroup label="Enrolled Scheme Roster & Ticket Numbers">
                        {schemeDetails.enrolledMembers.map((m) => {
                          const ticketKey = `${m.member_id}_${m.ticket_number || 1}`;
                          // Block by MEMBER_ID — one person can only win ONCE per scheme
                          const isIneligible = previousWinnerMemberIds.has(Number(m.member_id));
                          const wonMonth = getMemberWonMonth(m.member_id);
                          return (
                            <option
                              key={`enrolled-${m.member_id}-${m.ticket_number}`}
                              value={ticketKey}
                              disabled={isIneligible}
                              style={isIneligible ? { color: '#dc2626', backgroundColor: '#fef2f2', fontWeight: 'bold' } : {}}
                            >
                              Ticket #{m.ticket_number}: {m.name} ({m.member_code}) {isIneligible ? `— 🚫 ALREADY WON MONTH ${wonMonth} (INELIGIBLE)` : '— ✅ Eligible to Bid'}
                            </option>
                          );
                        })}
                      </optgroup>
                    )}

                    {/* 2. Other Registered System Members (Auto-Enroll) */}
                    {(() => {
                      const enrolledMemberIds = new Set(schemeDetails?.enrolledMembers?.map(m => Number(m.member_id)) || []);
                      const unenrolledMembers = allMembers.filter(m => !enrolledMemberIds.has(Number(m.id)));
                      
                      if (unenrolledMembers.length === 0) return null;
                      
                      return (
                        <optgroup label="Other Registered Members (Auto-Enroll on Selection)">
                          {unenrolledMembers.map((m) => {
                            // Also check if this unenrolled member has previously won via another ticket
                            const isIneligible = previousWinnerMemberIds.has(Number(m.id));
                            const wonMonth = getMemberWonMonth(m.id);
                            return (
                              <option
                                key={`system-${m.id}`}
                                value={m.id}
                                disabled={isIneligible}
                                style={isIneligible ? { color: '#dc2626', backgroundColor: '#fef2f2', fontWeight: 'bold' } : {}}
                              >
                                {m.name} ({m.member_code}) - Phone: {m.contact_no_1} {isIneligible ? `— 🚫 ALREADY WON MONTH ${wonMonth} (INELIGIBLE)` : '— ⚡ Auto-Enroll on Selection'}
                              </option>
                            );
                          })}
                        </optgroup>
                      );
                    })()}
                  </>
                )}
              </select>

              {/* Roster Live Bidding Eligibility Grid */}
              {schemeDetails?.enrolledMembers?.length > 0 && (
                <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-slate-700 uppercase tracking-wider">
                      Scheme Roster Bidding Status ({schemeDetails.enrolledMembers.length} Tickets Enrolled)
                    </span>
                    <span className="text-slate-500 font-medium">
                      <span className="text-emerald-700 font-bold">✓ Green = Eligible</span> | <span className="text-rose-600 font-bold">🚫 Red = Previous Winner (Ineligible)</span>
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2 text-xs pt-1">
                    {schemeDetails.enrolledMembers.map((m) => {
                      const ticketKey = `${m.member_id}_${m.ticket_number || 1}`;
                      // Block by MEMBER_ID — mark ALL tickets of a previous winner red
                      const isIneligible = previousWinnerMemberIds.has(Number(m.member_id));
                      const wonMonth = getMemberWonMonth(m.member_id);
                      return (
                        <div
                          key={`badge-${ticketKey}`}
                          className={`px-2.5 py-1.5 rounded-lg border font-bold text-[11px] flex items-center gap-1.5 shadow-2xs ${
                            isIneligible
                              ? 'bg-rose-100 text-rose-900 border-rose-300 ring-1 ring-rose-400/50'
                              : 'bg-emerald-50 text-emerald-900 border-emerald-300'
                          }`}
                        >
                          <span className="font-mono text-[10px] bg-white/70 px-1 py-0.5 rounded border border-slate-200">T#{m.ticket_number}</span>
                          <span>{m.name}</span>
                          {isIneligible ? (
                            <span className="bg-rose-600 text-white text-[9px] px-1.5 py-0.5 rounded font-extrabold ml-1 uppercase shadow-xs">
                              🚫 WON MONTH {wonMonth} (INELIGIBLE)
                            </span>
                          ) : (
                            <span className="bg-emerald-600 text-white text-[9px] px-1.5 py-0.5 rounded font-extrabold ml-1 uppercase shadow-xs">
                              ✓ ELIGIBLE
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {!selectedSchemeId && (
                <p className="mt-1 text-[11px] text-slate-500 italic">Please select an active chit scheme above to view member options.</p>
              )}
              {selectedSchemeId && (
                <p className="mt-1 text-[11px] text-slate-600 font-medium flex items-center gap-1">
                  <span>💡 Tip: You can select an enrolled member or choose any registered member from the directory to auto-enroll them on auction recording.</span>
                </p>
              )}
            </div>

            {/* Notes */}
            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1.5">Auction Notes / Minutes</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional remarks (e.g., Highest bidder after 15 rounds)"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Winner Payout Payment Mode & Proof */}
            <div className="sm:col-span-2">
              <div className="mt-1 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-extrabold text-emerald-800">💸 Winner Payout Payment Details</span>
                  <span className="text-[10px] text-emerald-600 font-semibold">(How is the winner being paid?)</span>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1.5 text-xs">Payout Method *</label>
                  <select
                    value={payoutMode}
                    onChange={(e) => {
                      const mode = e.target.value;
                      setPayoutMode(mode);
                      setPayoutRefNo('');
                      setPayoutBankName('');
                      setPayoutChequeNo('');
                      setPayoutProofImage('');
                      setPayoutPreviewUrl('');
                    }}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="Bank Transfer">🏦 Bank Transfer (NEFT / RTGS / IMPS)</option>
                    <option value="UPI">📱 UPI / GPay / PhonePe / Paytm</option>
                    <option value="Cheque">📜 Cheque Payment</option>
                    <option value="Cash">💵 Cash Payout</option>
                  </select>
                </div>

                {/* Bank Transfer */}
                {payoutMode === 'Bank Transfer' && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1 text-xs">Beneficiary Bank Name *</label>
                        <input
                          type="text"
                          required
                          value={payoutBankName}
                          onChange={(e) => setPayoutBankName(e.target.value)}
                          placeholder="e.g. HDFC Bank, State Bank of India"
                          className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1 text-xs">Bank UTR / Transaction Ref No.</label>
                        <input
                          type="text"
                          value={payoutRefNo}
                          onChange={(e) => setPayoutRefNo(e.target.value)}
                          placeholder="e.g. N20261984210"
                          className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono bg-white"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1 text-xs">Upload Bank Transfer Receipt / Proof Screenshot</label>
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        onChange={handlePayoutProofFileChange}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-xl text-xs bg-white cursor-pointer"
                      />
                      {payoutPreviewUrl && (
                        <div className="mt-2 p-2 border rounded-xl bg-white flex items-center gap-3 shadow-xs">
                          <img src={payoutPreviewUrl} alt="Payout Proof" className="w-14 h-14 object-cover rounded-lg border" />
                          <div className="text-[11px]">
                            <span className="font-bold text-emerald-700 block">✓ Bank Transfer Proof Uploaded</span>
                            <span className="text-slate-500 text-[10px]">Attached to auction record</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* UPI */}
                {payoutMode === 'UPI' && (
                  <div className="space-y-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1 text-xs">UPI Transaction UTR / Ref No.</label>
                      <input
                        type="text"
                        value={payoutRefNo}
                        onChange={(e) => setPayoutRefNo(e.target.value)}
                        placeholder="e.g. UPI/664239812 or 12-digit UTR"
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono bg-white"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1 text-xs">Upload UPI Payment Screenshot *</label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handlePayoutProofFileChange}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-xl text-xs bg-white cursor-pointer"
                      />
                      {payoutPreviewUrl && (
                        <div className="mt-2 p-2 border rounded-xl bg-white flex items-center gap-3 shadow-xs">
                          <img src={payoutPreviewUrl} alt="UPI Payout Proof" className="w-14 h-14 object-cover rounded-lg border" />
                          <div className="text-[11px]">
                            <span className="font-bold text-emerald-700 block">✓ UPI Screenshot Uploaded</span>
                            <span className="text-slate-500 text-[10px]">Attached to auction record</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Cheque */}
                {payoutMode === 'Cheque' && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1 text-xs">Cheque Number *</label>
                        <input
                          type="text"
                          required
                          value={payoutChequeNo}
                          onChange={(e) => setPayoutChequeNo(e.target.value)}
                          placeholder="e.g. CHK-492104"
                          className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono bg-white"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1 text-xs">Drawee Bank Name *</label>
                        <input
                          type="text"
                          required
                          value={payoutBankName}
                          onChange={(e) => setPayoutBankName(e.target.value)}
                          placeholder="e.g. ICICI Bank"
                          className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1 text-xs">Cheque Date *</label>
                        <input
                          type="date"
                          required
                          value={payoutChequeDate}
                          onChange={(e) => setPayoutChequeDate(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1 text-xs">Upload Cheque Leaf Screenshot / Photo *</label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handlePayoutProofFileChange}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-xl text-xs bg-white cursor-pointer"
                      />
                      {payoutPreviewUrl && (
                        <div className="mt-2 p-2 border rounded-xl bg-white flex items-center gap-3 shadow-xs">
                          <img src={payoutPreviewUrl} alt="Cheque Leaf" className="w-14 h-14 object-cover rounded-lg border" />
                          <div className="text-[11px]">
                            <span className="font-bold text-amber-800 block">✓ Cheque Leaf Photo Uploaded</span>
                            <span className="text-slate-500 text-[10px]">Attached to auction record</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Cash */}
                {payoutMode === 'Cash' && (
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1 text-xs">Cash Disbursed By / Staff Note</label>
                    <input
                      type="text"
                      value={payoutRefNo}
                      onChange={(e) => setPayoutRefNo(e.target.value)}
                      placeholder="e.g. Disbursed at office by Manager"
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white"
                    />
                  </div>
                )}
              </div>
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
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {auctions.map((auc) => (
                <tr key={auc.id} className="hover:bg-slate-50">
                  <td className="p-3.5 font-bold text-slate-900">{auc.scheme_name}</td>
                  <td className="p-3.5 font-bold text-blue-600">Month {auc.month_number}</td>
                  <td className="p-3.5 text-slate-600">{formatDate(auc.auction_date)}</td>
                  <td className="p-3.5 font-bold text-slate-800">
                    {auc.winner_name} ({auc.winner_code})
                    <span className="font-mono text-[10px] text-blue-600 block">Ticket #{auc.winning_ticket_number || 1}</span>
                  </td>
                  <td className="p-3.5 font-semibold text-amber-600">-{formatCurrency(auc.winning_bid_discount)}</td>
                  <td className="p-3.5 text-slate-600">{formatCurrency(auc.foreman_commission)}</td>
                  <td className="p-3.5 font-extrabold text-emerald-700">{formatCurrency(auc.winner_payout)}</td>
                  <td className="p-3.5 font-bold text-blue-700">{formatCurrency(auc.dividend_per_member)}</td>
                  <td className="p-3.5 font-bold text-slate-900">{formatCurrency(auc.next_month_payable)}</td>
                  <td className="p-3.5 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => openEditModal(auc)}
                        className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white transition"
                        title="Edit Auction Record"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteModalAuction(auc)}
                        className="p-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white transition"
                        title="Delete Auction Record"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Auction Modal */}
      {editModalAuction && (
        <Modal
          isOpen={!!editModalAuction}
          onClose={() => setEditModalAuction(null)}
          title={`Edit Auction Record: ${editModalAuction.scheme_name} (Month ${editModalAuction.month_number})`}
        >
          <form onSubmit={handleSaveEditAuction} className="space-y-4 text-xs">
            <div className="p-3 bg-slate-50 border rounded-xl space-y-1 font-semibold text-slate-700">
              <p>Scheme: <strong>{editModalAuction.scheme_name}</strong> ({editModalAuction.scheme_code})</p>
              <p>Auction Month: <strong>Month {editModalAuction.month_number}</strong></p>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Winning Member & Ticket *</label>
              <select
                required
                value={editWinnerKey}
                onChange={(e) => setEditWinnerKey(e.target.value)}
                className="w-full px-3 py-2 border rounded-xl font-medium"
              >
                {allMembers.map((m) => (
                  <option key={`edit-mem-${m.id}`} value={`${m.id}_1`}>
                    {m.name} ({m.member_code}) - Phone: {m.contact_no_1}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Winning Bid Discount (₹) *</label>
              <input
                type="number"
                required
                value={editDiscount}
                onChange={(e) => setEditDiscount(e.target.value)}
                className="w-full px-3 py-2 border rounded-xl font-bold text-amber-700"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Auction Date *</label>
              <input
                type="date"
                required
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
                className="w-full px-3 py-2 border rounded-xl"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Notes / Remarks</label>
              <input
                type="text"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Remarks"
                className="w-full px-3 py-2 border rounded-xl"
              />
            </div>

            <div className="pt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditModalAuction(null)}
                className="px-4 py-2 border rounded-xl font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-xl font-bold shadow-md"
              >
                Update Auction
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete Auction Confirmation Modal */}
      {deleteModalAuction && (
        <Modal
          isOpen={!!deleteModalAuction}
          onClose={() => setDeleteModalAuction(null)}
          title={`Delete Auction: Month ${deleteModalAuction.month_number}`}
        >
          <div className="space-y-4 text-xs">
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-rose-900 font-bold">Are you sure you want to delete this auction record?</p>
                <p className="text-rose-700">
                  Scheme: <strong>{deleteModalAuction.scheme_name}</strong> (Month {deleteModalAuction.month_number})
                  <br />
                  Winner: <strong>{deleteModalAuction.winner_name}</strong>
                </p>
                <p className="text-rose-600 font-semibold pt-1">
                  ⚠️ Deleting this auction will revert the dividend calculations and remove the monthly payment dues generated for this month. The winning member will become ELIGIBLE to bid again!
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteModalAuction(null)}
                className="px-4 py-2 border rounded-xl font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteAuction}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-bold shadow-md"
              >
                Delete Auction
              </button>
            </div>
          </div>
        </Modal>
      )}

    </div>
  );
}

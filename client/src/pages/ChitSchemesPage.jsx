import React, { useState, useEffect } from 'react';
import API from '../services/api';
import Toast from '../components/common/Toast';
import Modal from '../components/common/Modal';
import { formatCurrency } from '../utils/formatters';
import {
  Layers,
  Plus,
  UserPlus,
  Users,
  Calendar,
  IndianRupee,
  CheckCircle2,
  Clock,
  Trash2,
  Info,
  Eye,
  Search,
  Check,
  AlertTriangle
} from 'lucide-react';

export default function ChitSchemesPage() {
  const [schemes, setSchemes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState({ type: '', message: '' });

  // Create Scheme Modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newScheme, setNewScheme] = useState({
    scheme_name: '₹1,00,000 Chit Scheme',
    total_chit_value: 100000,
    duration_months: 20,
    number_of_members: 20,
    monthly_contribution: 5000,
    foreman_commission_percent: 5
  });

  // Enroll Member Modal
  const [enrollModalScheme, setEnrollModalScheme] = useState(null);
  const [availableMembers, setAvailableMembers] = useState([]);
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [ticketNumber, setTicketNumber] = useState('');

  // Scheme Details & Member Payments Modal
  const [viewSchemeModal, setViewSchemeModal] = useState(null);
  const [schemeDetails, setSchemeDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [searchMemberQuery, setSearchMemberQuery] = useState('');

  useEffect(() => {
    fetchSchemes();
  }, []);

  const fetchSchemes = async () => {
    try {
      setLoading(true);
      const res = await API.get('/chits');
      if (res.data.success) {
        setSchemes(res.data.schemes);
      }
    } catch (err) {
      console.error('Fetch schemes failed:', err);
      setToast({ type: 'error', message: 'Failed to retrieve chit schemes.' });
    } finally {
      setLoading(false);
    }
  };

  const openSchemeDetailsModal = async (sch) => {
    setViewSchemeModal(sch);
    setLoadingDetails(true);
    try {
      const res = await API.get(`/chits/${sch.id}`);
      if (res.data.success) {
        setSchemeDetails(res.data);
      }
    } catch (err) {
      console.error('Fetch scheme details failed:', err);
      setToast({ type: 'error', message: 'Failed to load scheme details.' });
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleCreateScheme = async (e) => {
    e.preventDefault();
    try {
      const res = await API.post('/chits', newScheme);
      if (res.data.success) {
        setToast({ type: 'success', message: `Chit scheme created successfully! Code: ${res.data.schemeCode}` });
        setCreateModalOpen(false);
        fetchSchemes();
      }
    } catch (err) {
      setToast({ type: 'error', message: err.response?.data?.message || 'Failed to create chit scheme.' });
    }
  };

  const openEnrollModal = async (sch) => {
    setEnrollModalScheme(sch);
    try {
      const res = await API.get('/members?limit=100');
      if (res.data.success) {
        setAvailableMembers(res.data.members);
      }
    } catch (err) {
      setToast({ type: 'error', message: 'Failed to load member roster.' });
    }
  };

  const handleEnrollMember = async (e) => {
    e.preventDefault();
    if (!selectedMemberId) return;

    try {
      const res = await API.post(`/chits/${enrollModalScheme.id}/enroll`, {
        member_id: selectedMemberId,
        ticket_number: ticketNumber
      });
      if (res.data.success) {
        setToast({ type: 'success', message: res.data.message });
        setEnrollModalScheme(null);
        setSelectedMemberId('');
        setTicketNumber('');
        fetchSchemes();
      }
    } catch (err) {
      setToast({ type: 'error', message: err.response?.data?.message || 'Failed to enroll member.' });
    }
  };

  return (
    <div className="space-y-6 pb-12">
      
      <Toast type={toast.type} message={toast.message} onClose={() => setToast({ type: '', message: '' })} />

      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-blue-600" />
            <h2 className="text-xl font-bold text-slate-900">Chit Schemes Management</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Create chit schemes, manage member enrollment rosters, and track active chits.
          </p>
        </div>

        <button
          onClick={() => setCreateModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/30 transition"
        >
          <Plus className="w-4 h-4" />
          <span>Create New Scheme</span>
        </button>
      </div>

      {/* Schemes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full py-12 text-center text-slate-500">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <span>Loading chit schemes...</span>
          </div>
        ) : schemes.map((sch) => (
          <div key={sch.id} className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 flex flex-col justify-between space-y-4 hover:shadow-md transition">
            
            <div className="space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <span className="font-mono text-[11px] font-bold text-blue-600">{sch.scheme_code}</span>
                  <h3 className="text-lg font-bold text-slate-900">{sch.scheme_name}</h3>
                </div>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                  sch.status === 'Active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                }`}>
                  {sch.status}
                </span>
              </div>

              {/* Stat breakdown */}
              <div className="grid grid-cols-2 gap-2 text-xs p-3 bg-slate-50 rounded-xl border border-slate-100">
                <div>
                  <span className="text-slate-400 text-[11px]">Total Chit Value</span>
                  <p className="font-extrabold text-slate-900">{formatCurrency(sch.total_chit_value)}</p>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px]">Duration</span>
                  <p className="font-extrabold text-slate-900">{sch.duration_months} Months</p>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px]">Monthly Contribution</span>
                  <p className="font-extrabold text-blue-600">{formatCurrency(sch.monthly_contribution)}</p>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px]">Foreman Commission</span>
                  <p className="font-extrabold text-slate-900">{sch.foreman_commission_percent}% ({formatCurrency(sch.foreman_commission_amount)})</p>
                </div>
              </div>

              {/* Progress bar */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-medium text-slate-600">Member Capacity</span>
                  <span className="font-bold text-slate-900">{sch.enrolled_members_count} / {sch.number_of_members}</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600 rounded-full transition-all"
                    style={{ width: `${Math.min(100, (sch.enrolled_members_count / sch.number_of_members) * 100)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
              <button
                onClick={() => openSchemeDetailsModal(sch)}
                className="px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>View Details</span>
              </button>

              <button
                onClick={() => openEnrollModal(sch)}
                className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
              >
                <UserPlus className="w-3.5 h-3.5 text-blue-400" />
                <span>Enroll Member</span>
              </button>
            </div>

          </div>
        ))}
      </div>

      {/* Create Scheme Modal */}
      {createModalOpen && (
        <Modal
          isOpen={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
          title="Create New Chit Scheme"
        >
          <form onSubmit={handleCreateScheme} className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Scheme Name *</label>
              <input
                type="text"
                required
                value={newScheme.scheme_name}
                onChange={(e) => setNewScheme({ ...newScheme, scheme_name: e.target.value })}
                placeholder="e.g. ₹5,00,000 Special Chit Scheme"
                className="w-full px-3 py-2 border rounded-xl"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Total Chit Value (₹) *</label>
                <input
                  type="number"
                  required
                  value={newScheme.total_chit_value}
                  onChange={(e) => setNewScheme({ ...newScheme, total_chit_value: Number(e.target.value) })}
                  className="w-full px-3 py-2 border rounded-xl"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Duration (Months) *</label>
                <input
                  type="number"
                  required
                  value={newScheme.duration_months}
                  onChange={(e) => setNewScheme({ ...newScheme, duration_months: Number(e.target.value) })}
                  className="w-full px-3 py-2 border rounded-xl"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Number of Members *</label>
                <input
                  type="number"
                  required
                  value={newScheme.number_of_members}
                  onChange={(e) => setNewScheme({ ...newScheme, number_of_members: Number(e.target.value) })}
                  className="w-full px-3 py-2 border rounded-xl"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Monthly Contribution (₹) *</label>
                <input
                  type="number"
                  required
                  value={newScheme.monthly_contribution}
                  onChange={(e) => setNewScheme({ ...newScheme, monthly_contribution: Number(e.target.value) })}
                  className="w-full px-3 py-2 border rounded-xl"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Foreman Commission (%)</label>
              <input
                type="number"
                value={newScheme.foreman_commission_percent}
                onChange={(e) => setNewScheme({ ...newScheme, foreman_commission_percent: Number(e.target.value) })}
                className="w-full px-3 py-2 border rounded-xl"
              />
            </div>

            <div className="pt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                className="px-4 py-2 border rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white font-bold rounded-xl"
              >
                Create Scheme
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Enroll Member Modal */}
      {enrollModalScheme && (
        <Modal
          isOpen={!!enrollModalScheme}
          onClose={() => setEnrollModalScheme(null)}
          title={`Enroll Member in ${enrollModalScheme.scheme_name}`}
        >
          <form onSubmit={handleEnrollMember} className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Select Member *</label>
              <select
                required
                value={selectedMemberId}
                onChange={(e) => setSelectedMemberId(e.target.value)}
                className="w-full px-3 py-2 border rounded-xl"
              >
                <option value="">-- Choose Member from Directory --</option>
                {availableMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.member_code}) - {m.contact_no_1}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Ticket Number (Optional)</label>
              <input
                type="number"
                value={ticketNumber}
                onChange={(e) => setTicketNumber(e.target.value)}
                placeholder="Auto-assigned if left blank"
                className="w-full px-3 py-2 border rounded-xl"
              />
            </div>

            <div className="pt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEnrollModalScheme(null)}
                className="px-4 py-2 border rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white font-bold rounded-xl"
              >
                Enroll Member
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Scheme Members & Payment Breakdown Modal */}
      {viewSchemeModal && (
        <Modal
          isOpen={!!viewSchemeModal}
          onClose={() => {
            setViewSchemeModal(null);
            setSchemeDetails(null);
            setSearchMemberQuery('');
          }}
          title={`Scheme Members & Payment Breakdown: ${viewSchemeModal.scheme_name} (${viewSchemeModal.scheme_code})`}
          maxWidth="max-w-4xl"
        >
          <div className="space-y-5 text-xs">
            {loadingDetails || !schemeDetails ? (
              <div className="py-12 text-center text-slate-500 space-y-2">
                <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
                <p>Fetching enrolled members & payment metrics...</p>
              </div>
            ) : (
              <>
                {/* Scheme Header Summary Card */}
                <div className="p-4 bg-slate-900 text-white rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <span className="text-[10px] text-blue-400 font-mono font-bold uppercase tracking-wider block">
                      {schemeDetails.scheme.scheme_code}
                    </span>
                    <h3 className="text-lg font-bold text-white">{schemeDetails.scheme.scheme_name}</h3>
                    <p className="text-slate-400 text-xs">
                      Value: <strong>{formatCurrency(schemeDetails.scheme.total_chit_value)}</strong> • Duration: <strong>{schemeDetails.scheme.duration_months} Months</strong>
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <div className="bg-slate-800 px-3 py-2 rounded-xl text-right">
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Monthly Base</span>
                      <span className="text-sm font-extrabold text-blue-400">{formatCurrency(schemeDetails.scheme.monthly_contribution)}</span>
                    </div>
                    <div className="bg-slate-800 px-3 py-2 rounded-xl text-right">
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Enrolled Members</span>
                      <span className="text-sm font-extrabold text-emerald-400">
                        {schemeDetails.enrolledMembers.length} / {schemeDetails.scheme.number_of_members}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Filter Search Bar */}
                <div className="flex items-center justify-between gap-3">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Search member name, member code, or ticket number..."
                      value={searchMemberQuery}
                      onChange={(e) => setSearchMemberQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <span className="text-slate-500 text-[11px] font-semibold">
                    {schemeDetails.enrolledMembers.length} Participated Members
                  </span>
                </div>

                {/* Enrolled Members Breakdown Table */}
                <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 font-bold uppercase text-[11px]">
                        <th className="p-3">Ticket & Member</th>
                        <th className="p-3">Monthly Base</th>
                        <th className="p-3">Months Paid</th>
                        <th className="p-3">Remaining to Pay</th>
                        <th className="p-3">Current Dues</th>
                        <th className="p-3">Auction Status</th>
                        <th className="p-3 text-center">Payment Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {schemeDetails.enrolledMembers
                        .filter(m => {
                          if (!searchMemberQuery) return true;
                          const q = searchMemberQuery.toLowerCase();
                          return (
                            m.name.toLowerCase().includes(q) ||
                            m.member_code.toLowerCase().includes(q) ||
                            String(m.ticket_number).includes(q)
                          );
                        })
                        .map((m) => {
                          const duration = schemeDetails.scheme.duration_months;
                          const paidCount = m.paid_months_count || 0;
                          const remainingCount = Math.max(0, duration - paidCount);
                          const isUpToDate = m.due_months_count === 0;

                          return (
                            <tr key={`sch-mbr-${m.enrollment_id}`} className="hover:bg-slate-50">
                              <td className="p-3">
                                <div className="flex items-center gap-2">
                                  <span className="px-2 py-0.5 bg-blue-100 text-blue-800 font-mono font-extrabold rounded-md text-[10px]">
                                    Ticket #{m.ticket_number}
                                  </span>
                                  <div>
                                    <p className="font-bold text-slate-900">{m.name}</p>
                                    <p className="text-[10px] text-slate-400">{m.member_code} • {m.contact_no_1}</p>
                                  </div>
                                </div>
                              </td>

                              <td className="p-3 font-extrabold text-blue-700">
                                {formatCurrency(m.monthly_base_payable)}
                              </td>

                              <td className="p-3">
                                <div>
                                  <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                    {paidCount} of {duration} Months Paid
                                  </span>
                                  <span className="text-[10px] text-slate-500 block mt-0.5">
                                    Total Paid: <strong>{formatCurrency(m.total_amount_paid)}</strong>
                                  </span>
                                </div>
                              </td>

                              <td className="p-3">
                                <div>
                                  <span className="font-bold text-blue-900 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                                    {remainingCount} Months Left to Pay
                                  </span>
                                  <span className="text-[10px] text-slate-500 block mt-0.5 font-medium">
                                    ({((paidCount / duration) * 100).toFixed(0)}% Completed)
                                  </span>
                                </div>
                              </td>

                              <td className="p-3">
                                {m.due_months_count > 0 ? (
                                  <div>
                                    <span className="font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                                      {m.due_months_count} Months Pending
                                    </span>
                                    <span className="text-[10px] text-rose-600 block mt-0.5 font-bold">
                                      Due Amount: {formatCurrency(m.total_amount_due)}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded text-[10px]">
                                    ✓ No Overdue
                                  </span>
                                )}
                              </td>

                              <td className="p-3">
                                {m.auction_win ? (
                                  <div>
                                    <span className="font-bold text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded text-[10px] block w-max">
                                      🏆 Won Month {m.auction_win.month_number}
                                    </span>
                                    <span className="text-[10px] text-slate-600 block mt-0.5">
                                      Payout: <strong>{formatCurrency(m.auction_win.winner_payout)}</strong>
                                    </span>
                                  </div>
                                ) : (
                                  <span className="font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded text-[10px]">
                                    ⏳ Active Bidding
                                  </span>
                                )}
                              </td>

                              <td className="p-3 text-center">
                                {isUpToDate ? (
                                  <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 font-bold rounded-lg text-[10px] inline-flex items-center gap-1">
                                    <Check className="w-3 h-3 text-emerald-600" /> Up-to-Date
                                  </span>
                                ) : (
                                  <span className="px-2.5 py-1 bg-amber-100 text-amber-800 font-bold rounded-lg text-[10px] inline-flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3 text-amber-600" /> {m.due_months_count} Due
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setViewSchemeModal(null);
                      setSchemeDetails(null);
                      setSearchMemberQuery('');
                    }}
                    className="px-4 py-2 bg-slate-900 text-white font-bold rounded-xl"
                  >
                    Close Breakdown
                  </button>
                </div>
              </>
            )}
          </div>
        </Modal>
      )}

    </div>
  );
}

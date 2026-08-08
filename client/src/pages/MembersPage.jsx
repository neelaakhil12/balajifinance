import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import API from '../services/api';
import Toast from '../components/common/Toast';
import Modal from '../components/common/Modal';
import {
  Users,
  Search,
  Filter,
  UserPlus,
  Eye,
  Edit,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Phone,
  Mail,
  AlertTriangle
} from 'lucide-react';

export default function MembersPage() {
  const navigate = useNavigate();

  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });

  // Filters & Search
  const [search, setSearch] = useState('');
  const [kycFilter, setKycFilter] = useState('');
  const [chitFilter, setChitFilter] = useState('');

  // Modals & Toast
  const [toast, setToast] = useState({ type: '', message: '' });
  const [editModalMember, setEditModalMember] = useState(null);
  const [deleteModalMember, setDeleteModalMember] = useState(null);

  useEffect(() => {
    fetchMembers(1);
  }, [search, kycFilter, chitFilter]);

  const fetchMembers = async (page = 1) => {
    try {
      setLoading(true);
      const res = await API.get('/members', {
        params: {
          page,
          limit: 10,
          search: search.trim(),
          kyc_status: kycFilter,
          chit_status: chitFilter
        }
      });
      if (res.data.success) {
        setMembers(res.data.members);
        setPagination(res.data.pagination);
      }
    } catch (err) {
      console.error('Fetch members failed:', err);
      setToast({ type: 'error', message: 'Failed to retrieve member records.' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeactivate = async () => {
    if (!deleteModalMember) return;
    try {
      const res = await API.delete(`/members/${deleteModalMember.id}`);
      if (res.data.success) {
        setToast({ type: 'success', message: `Member ${deleteModalMember.name} deactivated successfully.` });
        setDeleteModalMember(null);
        fetchMembers(pagination.page);
      }
    } catch (err) {
      setToast({ type: 'error', message: 'Failed to deactivate member.' });
    }
  };

  const handleUpdateMember = async (e) => {
    e.preventDefault();
    try {
      const res = await API.put(`/members/${editModalMember.id}`, editModalMember);
      if (res.data.success) {
        setToast({ type: 'success', message: 'Member details updated successfully.' });
        setEditModalMember(null);
        fetchMembers(pagination.page);
      }
    } catch (err) {
      setToast({ type: 'error', message: 'Failed to update member.' });
    }
  };

  return (
    <div className="space-y-6 pb-12">
      
      <Toast type={toast.type} message={toast.message} onClose={() => setToast({ type: '', message: '' })} />

      {/* Page Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            <h2 className="text-xl font-bold text-slate-900">Members Directory</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Total {pagination.total} registered chit fund members in system
          </p>
        </div>

        <Link
          to="/add-member"
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/30 transition self-start sm:self-auto"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add New Member</span>
        </Link>
      </div>

      {/* Search & Filter Control Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center gap-4">
        {/* Search Bar */}
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, phone, or member code..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          <select
            value={kycFilter}
            onChange={(e) => setKycFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All KYC Status</option>
            <option value="Verified">Verified</option>
            <option value="Pending">Pending</option>
            <option value="Inactive">Inactive</option>
          </select>

          <select
            value={chitFilter}
            onChange={(e) => setChitFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Chit Status</option>
            <option value="Active">Active</option>
            <option value="Deactivated">Deactivated</option>
          </select>
        </div>
      </div>

      {/* Members Data Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900 text-white text-xs font-semibold uppercase tracking-wider">
                <th className="py-3.5 px-4">Member ID</th>
                <th className="py-3.5 px-4">Member Name</th>
                <th className="py-3.5 px-4">Email</th>
                <th className="py-3.5 px-4">Contact Phone</th>
                <th className="py-3.5 px-4">Aadhaar (Masked)</th>
                <th className="py-3.5 px-4">KYC</th>
                <th className="py-3.5 px-4">Chit Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                      <span>Loading member directory...</span>
                    </div>
                  </td>
                </tr>
              ) : members.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    No members found matching search criteria.
                  </td>
                </tr>
              ) : (
                members.map((mbr) => (
                  <tr key={mbr.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3.5 px-4 font-mono font-bold text-blue-700">
                      {mbr.member_code}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      {mbr.name}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      {mbr.email}
                    </td>
                    <td className="py-3.5 px-4 text-slate-700 font-medium">
                      {mbr.contact_no_1}
                      {mbr.contact_no_2 && <span className="text-[10px] text-slate-400 block">{mbr.contact_no_2}</span>}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-600">
                      {mbr.masked_aadhaar}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        mbr.kyc_status === 'Verified'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : 'bg-amber-100 text-amber-800 border border-amber-300'
                      }`}>
                        {mbr.kyc_status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        mbr.chit_status === 'Active'
                          ? 'bg-blue-100 text-blue-800 border border-blue-300'
                          : 'bg-slate-100 text-slate-600 border border-slate-300'
                      }`}>
                        {mbr.chit_status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => navigate(`/members/${mbr.id}`)}
                          className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white transition"
                          title="View Profile & Documents"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setEditModalMember(mbr)}
                          className="p-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-800 hover:text-white transition"
                          title="Edit Member"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteModalMember(mbr)}
                          className="p-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white transition"
                          title="Deactivate Member"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {pagination.totalPages > 1 && (
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              Showing page {pagination.page} of {pagination.totalPages} ({pagination.total} total members)
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={pagination.page <= 1}
                onClick={() => fetchMembers(pagination.page - 1)}
                className="p-2 rounded-lg border border-slate-300 bg-white disabled:opacity-40 hover:bg-slate-100 text-xs font-semibold"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => fetchMembers(pagination.page + 1)}
                className="p-2 rounded-lg border border-slate-300 bg-white disabled:opacity-40 hover:bg-slate-100 text-xs font-semibold"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Edit Member Modal */}
      {editModalMember && (
        <Modal
          isOpen={!!editModalMember}
          onClose={() => setEditModalMember(null)}
          title={`Edit Member: ${editModalMember.member_code}`}
        >
          <form onSubmit={handleUpdateMember} className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Full Name</label>
              <input
                type="text"
                value={editModalMember.name}
                onChange={(e) => setEditModalMember({ ...editModalMember, name: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Email</label>
              <input
                type="email"
                value={editModalMember.email}
                onChange={(e) => setEditModalMember({ ...editModalMember, email: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Contact No. 1</label>
                <input
                  type="text"
                  value={editModalMember.contact_no_1}
                  onChange={(e) => setEditModalMember({ ...editModalMember, contact_no_1: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Contact No. 2</label>
                <input
                  type="text"
                  value={editModalMember.contact_no_2 || ''}
                  onChange={(e) => setEditModalMember({ ...editModalMember, contact_no_2: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Chit Status</label>
              <select
                value={editModalMember.chit_status}
                onChange={(e) => setEditModalMember({ ...editModalMember, chit_status: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="Active">Active</option>
                <option value="Deactivated">Deactivated</option>
              </select>
            </div>
            <div className="pt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditModalMember(null)}
                className="px-4 py-2 border rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold"
              >
                Save Changes
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete/Deactivate Confirmation Modal */}
      {deleteModalMember && (
        <Modal
          isOpen={!!deleteModalMember}
          onClose={() => setDeleteModalMember(null)}
          title="Confirm Member Deactivation"
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
              <p className="text-amber-900 font-medium">
                Are you sure you want to deactivate member <strong>{deleteModalMember.name}</strong> ({deleteModalMember.member_code})?
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setDeleteModalMember(null)}
                className="px-4 py-2 border rounded-lg font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleDeactivate}
                className="px-4 py-2 bg-rose-600 text-white rounded-lg font-bold"
              >
                Deactivate Member
              </button>
            </div>
          </div>
        </Modal>
      )}

    </div>
  );
}

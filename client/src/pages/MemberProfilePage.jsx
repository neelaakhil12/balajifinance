import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import API from '../services/api';
import Toast from '../components/common/Toast';
import Modal from '../components/common/Modal';
import { formatCurrency, formatDate } from '../utils/formatters';
import {
  User,
  ShieldCheck,
  FileText,
  Download,
  Eye,
  Layers,
  CreditCard,
  Gavel,
  PieChart,
  ArrowLeft,
  CheckCircle2,
  Lock
} from 'lucide-react';

export default function MemberProfilePage() {
  const { id } = useParams();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('personal');
  const [toast, setToast] = useState({ type: '', message: '' });

  // Document Preview Modal State
  const [previewDoc, setPreviewDoc] = useState(null);

  useEffect(() => {
    fetchMemberProfile();
  }, [id]);

  const fetchMemberProfile = async () => {
    try {
      setLoading(true);
      const res = await API.get(`/members/${id}`);
      if (res.data.success) {
        setData(res.data);
      }
    } catch (err) {
      console.error('Fetch profile failed:', err);
      setToast({ type: 'error', message: 'Failed to load member profile.' });
    } finally {
      setLoading(false);
    }
  };

  const getDocUrl = (docId) => {
    const token = localStorage.getItem('balaji_token');
    return `/api/members/${id}/documents/${docId}?token=${token}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 bg-rose-50 text-rose-700 rounded-xl border border-rose-200 text-sm font-semibold">
        Member profile not found.
      </div>
    );
  }

  const { member, kycDocs, chitSchemes, payments, auctionsWon, dividends } = data;

  return (
    <div className="space-y-6 pb-12">
      
      <Toast type={toast.type} message={toast.message} onClose={() => setToast({ type: '', message: '' })} />

      {/* Top Navigation */}
      <div>
        <Link to="/members" className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800">
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Members Directory</span>
        </Link>
      </div>

      {/* Member Profile Header Card */}
      <div className="bg-slate-900 text-white p-6 rounded-2xl border border-slate-800 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-extrabold text-2xl shadow-lg border border-blue-400/30">
            {member.name.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-blue-400 text-sm">{member.member_code}</span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                {member.kyc_status} KYC
              </span>
            </div>
            <h2 className="text-2xl font-extrabold tracking-tight text-white mt-0.5">{member.name}</h2>
            <p className="text-xs text-slate-400 mt-1">{member.email} • {member.contact_no_1}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-slate-800/80 px-4 py-2 rounded-xl border border-slate-700 text-right">
            <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block">Enrolled Schemes</span>
            <span className="text-base font-extrabold text-blue-400">{chitSchemes.length} Active</span>
          </div>
        </div>
      </div>

      {/* Profile Section Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto pb-1">
        {[
          { id: 'personal', label: 'Personal & Contact Info', icon: User },
          { id: 'kyc', label: 'KYC & Secure Documents', icon: ShieldCheck },
          { id: 'chits', label: `Chit Schemes (${chitSchemes.length})`, icon: Layers },
          { id: 'payments', label: `Payment History (${payments.length})`, icon: CreditCard },
          { id: 'auctions', label: `Auction Wins (${auctionsWon.length})`, icon: Gavel },
          { id: 'dividends', label: `Dividend Ledger (${dividends.length})`, icon: PieChart }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs font-bold transition whitespace-nowrap border-b-2 ${
                isActive
                  ? 'border-blue-600 text-blue-600 bg-white shadow-xs'
                  : 'border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-100/50'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB CONTENTS */}

      {/* 1. Personal Info Tab */}
      {activeTab === 'personal' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Member Personal Profile</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 text-xs">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-slate-400 font-medium block mb-1">Full Member Name</span>
              <span className="text-slate-900 font-bold text-sm">{member.name}</span>
            </div>
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-slate-400 font-medium block mb-1">Member Unique Code</span>
              <span className="font-mono font-bold text-blue-700 text-sm">{member.member_code}</span>
            </div>
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-slate-400 font-medium block mb-1">Email Address</span>
              <span className="text-slate-900 font-bold text-sm">{member.email}</span>
            </div>
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-slate-400 font-medium block mb-1">Primary Phone Number</span>
              <span className="text-slate-900 font-bold text-sm">{member.contact_no_1}</span>
            </div>
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-slate-400 font-medium block mb-1">Alternate Phone Number</span>
              <span className="text-slate-900 font-bold text-sm">{member.contact_no_2 || 'Not Provided'}</span>
            </div>
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-slate-400 font-medium block mb-1">Aadhaar Number (Masked)</span>
              <span className="font-mono font-bold text-slate-900 text-sm">{member.masked_aadhaar}</span>
            </div>
          </div>
        </div>
      )}

      {/* 2. KYC Documents Tab */}
      {activeTab === 'kyc' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Stored KYC Documents</h3>
              <p className="text-xs text-slate-500">Protected server storage with tokenized verification</p>
            </div>
            <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-bold flex items-center gap-1">
              <Lock className="w-3.5 h-3.5" />
              <span>Encrypted Storage</span>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {kycDocs.map((doc) => (
              <div key={doc.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-blue-100 text-blue-700 rounded-lg">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 uppercase">{doc.document_type} Document</h4>
                    <p className="text-[11px] text-slate-500 font-mono mt-0.5">{doc.original_name}</p>
                    <span className="text-[10px] text-slate-400 block">{formatDate(doc.uploaded_at)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPreviewDoc(doc)}
                    className="p-2 rounded-lg bg-blue-600 text-white hover:bg-blue-500 text-xs font-bold flex items-center gap-1"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>View</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. Assigned Chit Schemes Tab */}
      {activeTab === 'chits' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Assigned Chit Fund Schemes</h3>
          <div className="divide-y divide-slate-100">
            {chitSchemes.length === 0 ? (
              <p className="text-xs text-slate-500 py-4">Member is not enrolled in any chit scheme.</p>
            ) : (
              chitSchemes.map((sch) => (
                <div key={sch.id} className="py-4 flex items-center justify-between">
                  <div>
                    <span className="font-mono text-xs font-bold text-blue-600">{sch.scheme_code}</span>
                    <h4 className="text-sm font-bold text-slate-900">{sch.scheme_name}</h4>
                    <p className="text-xs text-slate-500">
                      Total Value: {formatCurrency(sch.total_chit_value)} • Ticket #{sch.ticket_number}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="px-3 py-1 bg-blue-50 text-blue-700 font-bold text-xs rounded-full border border-blue-200">
                      {formatCurrency(sch.monthly_contribution)} / month
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 4. Payment History Tab */}
      {activeTab === 'payments' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
            <h3 className="text-sm font-bold text-slate-900 uppercase">Monthly Payment History</h3>
          </div>
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-900 text-white font-semibold uppercase">
                <th className="p-3">Month</th>
                <th className="p-3">Scheme</th>
                <th className="p-3">Base Contribution</th>
                <th className="p-3">Dividend Applied</th>
                <th className="p-3">Net Due</th>
                <th className="p-3">Amount Paid</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {payments.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="p-3 font-bold text-blue-700">Month {p.month_number}</td>
                  <td className="p-3 font-medium text-slate-800">{p.scheme_name}</td>
                  <td className="p-3 font-semibold text-slate-700">{formatCurrency(p.base_contribution)}</td>
                  <td className="p-3 text-emerald-600 font-semibold">-{formatCurrency(p.dividend_applied)}</td>
                  <td className="p-3 font-bold text-slate-900">{formatCurrency(p.net_amount_due)}</td>
                  <td className="p-3 font-bold text-emerald-700">{formatCurrency(p.amount_paid)}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      p.status === 'Paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {p.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Document Viewer Modal */}
      {previewDoc && (
        <Modal
          isOpen={!!previewDoc}
          onClose={() => setPreviewDoc(null)}
          title={`KYC Document Preview: ${previewDoc.original_name}`}
          maxWidth="max-w-4xl"
        >
          <div className="space-y-4">
            <div className="h-[60vh] bg-slate-900 rounded-xl overflow-hidden flex items-center justify-center p-4">
              {previewDoc.mime_type.includes('pdf') ? (
                <iframe
                  src={getDocUrl(previewDoc.id)}
                  className="w-full h-full rounded-lg"
                  title="PDF Viewer"
                />
              ) : (
                <img
                  src={getDocUrl(previewDoc.id)}
                  alt="KYC Document"
                  className="max-h-full max-w-full object-contain rounded-lg shadow-lg"
                />
              )}
            </div>
            <div className="flex justify-end">
              <a
                href={getDocUrl(previewDoc.id)}
                download={previewDoc.original_name}
                className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md"
              >
                <Download className="w-4 h-4" />
                <span>Download Document</span>
              </a>
            </div>
          </div>
        </Modal>
      )}

    </div>
  );
}

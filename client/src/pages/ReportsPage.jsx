import React, { useState, useEffect } from 'react';
import API from '../services/api';
import Toast from '../components/common/Toast';
import { formatCurrency, formatDate } from '../utils/formatters';
import {
  FileSpreadsheet,
  Download,
  Printer,
  FileText,
  Filter,
  Users,
  Layers,
  CreditCard,
  Gavel,
  PieChart,
  AlertCircle
} from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';

export default function ReportsPage() {
  const [activeReport, setActiveReport] = useState('member');
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ type: '', message: '' });

  // Filters
  const [schemeFilter, setSchemeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    fetchReport();
  }, [activeReport, schemeFilter, statusFilter]);

  const fetchReport = async () => {
    try {
      setLoading(true);
      let endpoint = '/reports/member-report';
      if (activeReport === 'chit') endpoint = '/reports/chit-report';
      if (activeReport === 'collection') endpoint = '/reports/collection-report';
      if (activeReport === 'auction') endpoint = '/reports/auction-report';
      if (activeReport === 'dividend') endpoint = '/reports/dividend-report';
      if (activeReport === 'pending') endpoint = '/reports/pending-payments-report';

      const res = await API.get(endpoint, {
        params: { scheme_id: schemeFilter, status: statusFilter }
      });

      if (res.data.success) {
        setReportData(res.data.data);
      }
    } catch (err) {
      console.error('Fetch report error:', err);
      setToast({ type: 'error', message: 'Failed to generate report.' });
    } finally {
      setLoading(false);
    }
  };

  // Export to Excel/CSV
  const handleExportExcel = () => {
    if (reportData.length === 0) return;
    const worksheet = XLSX.utils.json_to_sheet(reportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Financial Report');
    XLSX.writeFile(workbook, `Balaji_ChitFund_${activeReport}_Report_${Date.now()}.xlsx`);
    setToast({ type: 'success', message: 'Report exported to Excel successfully.' });
  };

  // Export to PDF using jsPDF
  const handleExportPDF = () => {
    if (reportData.length === 0) return;

    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('BALAJI SAVINGS & FINANCE', 14, 15);
    doc.setFontSize(10);
    doc.text(`Financial Report: ${activeReport.toUpperCase()} REPORT`, 14, 22);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 27);

    let headers = [];
    let rows = [];

    if (activeReport === 'member') {
      headers = [['Code', 'Name', 'Email', 'Phone', 'Aadhaar', 'KYC', 'Status']];
      rows = reportData.map((m) => [m.member_code, m.name, m.email, m.contact_no_1, m.masked_aadhaar, m.kyc_status, m.chit_status]);
    } else if (activeReport === 'chit') {
      headers = [['Code', 'Name', 'Chit Value', 'Duration', 'Members', 'Contribution', 'Status']];
      rows = reportData.map((c) => [c.scheme_code, c.scheme_name, `INR ${c.total_chit_value}`, `${c.duration_months}m`, c.number_of_members, `INR ${c.monthly_contribution}`, c.status]);
    } else if (activeReport === 'collection') {
      headers = [['Scheme', 'Month', 'Member', 'Due', 'Paid', 'Date', 'Status']];
      rows = reportData.map((p) => [p.scheme_name, `M${p.month_number}`, p.member_name, `INR ${p.net_amount_due}`, `INR ${p.amount_paid}`, p.payment_date || 'N/A', p.status]);
    } else if (activeReport === 'auction') {
      headers = [['Scheme', 'Month', 'Winner', 'Discount', 'Winner Payout', 'Div/Member']];
      rows = reportData.map((a) => [a.scheme_name, `M${a.month_number}`, a.winner_name, `INR ${a.winning_bid_discount}`, `INR ${a.winner_payout}`, `INR ${a.dividend_per_member}`]);
    } else if (activeReport === 'pending') {
      headers = [['Scheme', 'Month', 'Member', 'Phone', 'Pending Due']];
      rows = reportData.map((p) => [p.scheme_name, `M${p.month_number}`, p.member_name, p.contact_no_1, `INR ${p.pending_balance}`]);
    } else {
      headers = [['ID', 'Name', 'Amount', 'Date']];
      rows = reportData.map((r) => [r.id || 1, r.name || 'N/A', r.amount || 0, r.created_at || 'N/A']);
    }

    doc.autoTable({
      head: headers,
      body: rows,
      startY: 32,
      styles: { fontSize: 8 }
    });

    doc.save(`Balaji_ChitFund_${activeReport}_Report.pdf`);
    setToast({ type: 'success', message: 'Report exported to PDF.' });
  };

  // Print Report View
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 pb-12">
      
      <Toast type={toast.type} message={toast.message} onClose={() => setToast({ type: '', message: '' })} />

      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div>
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-blue-600" />
            <h2 className="text-xl font-bold text-slate-900">Financial Reports & Statements</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Generate, view, print and export formal financial statements for Balaji Savings & Finance.
          </p>
        </div>

        {/* Export Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportPDF}
            className="px-3.5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Export PDF</span>
          </button>
          <button
            onClick={handleExportExcel}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Excel</span>
          </button>
          <button
            onClick={handlePrint}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* Report Selection Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto pb-1 no-print">
        {[
          { id: 'member', label: 'Member Report', icon: Users },
          { id: 'chit', label: 'Chit Scheme Report', icon: Layers },
          { id: 'collection', label: 'Monthly Collection Report', icon: CreditCard },
          { id: 'auction', label: 'Auction Report', icon: Gavel },
          { id: 'dividend', label: 'Dividend Report', icon: PieChart },
          { id: 'pending', label: 'Pending Payments Report', icon: AlertCircle }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeReport === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveReport(tab.id)}
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

      {/* Report Content Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden print-content">
        
        {/* Printable Header */}
        <div className="p-6 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-extrabold text-slate-900">BALAJI SAVINGS & FINANCE</h1>
            <p className="text-xs text-slate-500">Official Financial Statement • {activeReport.toUpperCase()} REPORT</p>
          </div>
          <div className="text-right text-xs text-slate-500">
            <p className="font-semibold text-slate-900">Date: {new Date().toLocaleDateString('en-IN')}</p>
            <p>Records: {reportData.length} entries</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-900 text-white font-semibold uppercase">
                {activeReport === 'member' && (
                  <>
                    <th className="p-3">Member ID</th>
                    <th className="p-3">Name</th>
                    <th className="p-3">Email</th>
                    <th className="p-3">Phone</th>
                    <th className="p-3">Aadhaar</th>
                    <th className="p-3">KYC</th>
                    <th className="p-3">Chit Status</th>
                  </>
                )}

                {activeReport === 'chit' && (
                  <>
                    <th className="p-3">Scheme Code</th>
                    <th className="p-3">Scheme Name</th>
                    <th className="p-3">Total Value</th>
                    <th className="p-3">Duration</th>
                    <th className="p-3">Members</th>
                    <th className="p-3">Contribution</th>
                    <th className="p-3">Status</th>
                  </>
                )}

                {activeReport === 'collection' && (
                  <>
                    <th className="p-3">Scheme</th>
                    <th className="p-3">Month</th>
                    <th className="p-3">Member</th>
                    <th className="p-3">Net Due</th>
                    <th className="p-3">Amount Paid</th>
                    <th className="p-3">Date</th>
                    <th className="p-3">Status</th>
                  </>
                )}

                {activeReport === 'auction' && (
                  <>
                    <th className="p-3">Scheme</th>
                    <th className="p-3">Month</th>
                    <th className="p-3">Winner</th>
                    <th className="p-3">Winning Discount</th>
                    <th className="p-3">Foreman Comm.</th>
                    <th className="p-3">Winner Payout</th>
                    <th className="p-3">Dividend / Member</th>
                  </>
                )}

                {activeReport === 'pending' && (
                  <>
                    <th className="p-3">Scheme</th>
                    <th className="p-3">Month</th>
                    <th className="p-3">Member</th>
                    <th className="p-3">Phone</th>
                    <th className="p-3">Net Amount Due</th>
                    <th className="p-3">Amount Paid</th>
                    <th className="p-3">Pending Balance</th>
                  </>
                )}

                {activeReport === 'dividend' && (
                  <>
                    <th className="p-3">Scheme</th>
                    <th className="p-3">Month</th>
                    <th className="p-3">Member</th>
                    <th className="p-3">Dividend Amount</th>
                  </>
                )}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    Generating report dataset...
                  </td>
                </tr>
              ) : reportData.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    No report records found.
                  </td>
                </tr>
              ) : (
                reportData.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    {activeReport === 'member' && (
                      <>
                        <td className="p-3 font-mono font-bold text-blue-700">{row.member_code}</td>
                        <td className="p-3 font-bold text-slate-900">{row.name}</td>
                        <td className="p-3 text-slate-600">{row.email}</td>
                        <td className="p-3 text-slate-700 font-medium">{row.contact_no_1}</td>
                        <td className="p-3 font-mono text-slate-600">{row.masked_aadhaar}</td>
                        <td className="p-3 font-semibold text-emerald-700">{row.kyc_status}</td>
                        <td className="p-3 font-bold text-blue-700">{row.chit_status}</td>
                      </>
                    )}

                    {activeReport === 'chit' && (
                      <>
                        <td className="p-3 font-mono font-bold text-blue-700">{row.scheme_code}</td>
                        <td className="p-3 font-bold text-slate-900">{row.scheme_name}</td>
                        <td className="p-3 font-extrabold text-slate-900">{formatCurrency(row.total_chit_value)}</td>
                        <td className="p-3 text-slate-700">{row.duration_months} Months</td>
                        <td className="p-3 font-semibold text-blue-700">{row.enrolled_members} / {row.number_of_members}</td>
                        <td className="p-3 font-semibold text-slate-800">{formatCurrency(row.monthly_contribution)}</td>
                        <td className="p-3 font-bold text-emerald-700">{row.status}</td>
                      </>
                    )}

                    {activeReport === 'collection' && (
                      <>
                        <td className="p-3 font-bold text-slate-900">{row.scheme_name}</td>
                        <td className="p-3 font-bold text-blue-600">M{row.month_number}</td>
                        <td className="p-3 font-bold text-slate-800">{row.member_name}</td>
                        <td className="p-3 font-bold text-slate-900">{formatCurrency(row.net_amount_due)}</td>
                        <td className="p-3 font-bold text-emerald-700">{formatCurrency(row.amount_paid)}</td>
                        <td className="p-3 text-slate-600">{row.payment_date ? formatDate(row.payment_date) : 'Pending'}</td>
                        <td className="p-3 font-bold">{row.status}</td>
                      </>
                    )}

                    {activeReport === 'auction' && (
                      <>
                        <td className="p-3 font-bold text-slate-900">{row.scheme_name}</td>
                        <td className="p-3 font-bold text-blue-600">Month {row.month_number}</td>
                        <td className="p-3 font-bold text-slate-800">{row.winner_name}</td>
                        <td className="p-3 font-semibold text-amber-600">-{formatCurrency(row.winning_bid_discount)}</td>
                        <td className="p-3 text-slate-600">{formatCurrency(row.foreman_commission)}</td>
                        <td className="p-3 font-extrabold text-emerald-700">{formatCurrency(row.winner_payout)}</td>
                        <td className="p-3 font-bold text-blue-700">{formatCurrency(row.dividend_per_member)}</td>
                      </>
                    )}

                    {activeReport === 'pending' && (
                      <>
                        <td className="p-3 font-bold text-slate-900">{row.scheme_name}</td>
                        <td className="p-3 font-bold text-blue-600">M{row.month_number}</td>
                        <td className="p-3 font-bold text-slate-800">{row.member_name}</td>
                        <td className="p-3 text-slate-700">{row.contact_no_1}</td>
                        <td className="p-3 font-bold text-slate-900">{formatCurrency(row.net_amount_due)}</td>
                        <td className="p-3 text-slate-600">{formatCurrency(row.amount_paid)}</td>
                        <td className="p-3 font-extrabold text-rose-600">{formatCurrency(row.pending_balance)}</td>
                      </>
                    )}

                    {activeReport === 'dividend' && (
                      <>
                        <td className="p-3 font-bold text-slate-900">{row.scheme_name}</td>
                        <td className="p-3 font-bold text-blue-600">Month {row.month_number}</td>
                        <td className="p-3 font-bold text-slate-800">{row.member_name}</td>
                        <td className="p-3 font-extrabold text-emerald-700">+{formatCurrency(row.dividend_amount)}</td>
                      </>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}

import React, { useState, useEffect } from 'react';
import API from '../services/api';
import Toast from '../components/common/Toast';
import Modal from '../components/common/Modal';
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
  AlertCircle,
  Eye,
  Image
} from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';

export default function ReportsPage() {
  const [activeReport, setActiveReport] = useState('member');
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ type: '', message: '' });
  const [proofModalData, setProofModalData] = useState(null);

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
    if (!reportData || reportData.length === 0) {
      setToast({ type: 'error', message: 'No data available to export.' });
      return;
    }

    let cleanData = [];

    if (activeReport === 'member') {
      cleanData = reportData.map(m => ({
        'Member Code': m.member_code || '',
        'Member Name': m.name || '',
        'Email Address': m.email || '',
        'Phone Number': m.contact_no_1 || '',
        'Aadhaar Number': m.masked_aadhaar || m.aadhaar_no || '',
        'KYC Status': m.kyc_status || 'Verified',
        'Chit Status': m.chit_status || 'Active'
      }));
    } else if (activeReport === 'chit') {
      cleanData = reportData.map(c => ({
        'Scheme Code': c.scheme_code || '',
        'Scheme Name': c.scheme_name || '',
        'Total Chit Value (₹)': Number(c.total_chit_value || 0),
        'Duration (Months)': Number(c.duration_months || 0),
        'Total Members': Number(c.number_of_members || 0),
        'Enrolled Members': Number(c.enrolled_members || 0),
        'Monthly Contribution (₹)': Number(c.monthly_contribution || 0),
        'Foreman Comm (%)': Number(c.foreman_commission_percent || 5),
        'Start Date': c.start_date ? c.start_date.split('T')[0] : '',
        'End Date': c.end_date ? c.end_date.split('T')[0] : '',
        'Status': c.status || 'Active'
      }));
    } else if (activeReport === 'collection') {
      cleanData = reportData.map(p => ({
        'Scheme Name': p.scheme_name || '',
        'Month': `Month ${p.month_number || 1}`,
        'Member Code': p.member_code || '',
        'Member Name': p.member_name || '',
        'Net Due (₹)': Number(p.net_amount_due || 0),
        'Amount Paid (₹)': Number(p.amount_paid || 0),
        'Payment Date': p.payment_date ? formatDate(p.payment_date) : 'Pending',
        'Payment Mode': p.payment_mode || 'N/A',
        'Reference / UTR': p.reference_no || '',
        'Status': p.status || 'Pending'
      }));
    } else if (activeReport === 'auction') {
      cleanData = reportData.map(a => ({
        'Scheme Name': a.scheme_name || '',
        'Auction Month': `Month ${a.month_number || 1}`,
        'Winner Name': a.winner_name || '',
        'Winning Discount (₹)': Number(a.winning_bid_discount || 0),
        'Foreman Comm (₹)': Number(a.foreman_commission || 0),
        'Winner Payout (₹)': Number(a.winner_payout || 0),
        'Dividend / Member (₹)': Number(a.dividend_per_member || 0),
        'Payout Mode': a.payout_mode || 'Bank Transfer',
        'Payout Ref No': a.payout_ref_no || '',
        'Auction Date': a.auction_date ? formatDate(a.auction_date) : ''
      }));
    } else if (activeReport === 'dividend') {
      cleanData = reportData.map(d => ({
        'Scheme Name': d.scheme_name || '',
        'Month': `Month ${d.month_number || 1}`,
        'Member Code': d.member_code || '',
        'Member Name': d.member_name || '',
        'Ticket No': d.ticket_number || 1,
        'Dividend Amount (₹)': Number(d.dividend_amount || 0),
        'Date': d.created_at ? formatDate(d.created_at) : ''
      }));
    } else if (activeReport === 'pending') {
      cleanData = reportData.map(p => ({
        'Scheme Name': p.scheme_name || '',
        'Month': `Month ${p.month_number || 1}`,
        'Member Code': p.member_code || '',
        'Member Name': p.member_name || '',
        'Phone Number': p.contact_no_1 || '',
        'Net Amount Due (₹)': Number(p.net_amount_due || 0),
        'Amount Paid (₹)': Number(p.amount_paid || 0),
        'Pending Balance (₹)': Number(p.pending_balance || 0),
        'Status': p.status || 'Pending'
      }));
    }

    const worksheet = XLSX.utils.json_to_sheet(cleanData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `${activeReport.toUpperCase()} Report`);
    XLSX.writeFile(workbook, `Balaji_ChitFund_${activeReport}_Report_${Date.now()}.xlsx`);
    setToast({ type: 'success', message: 'Report exported to Excel successfully.' });
  };

  // Export to PDF using jsPDF
  const handleExportPDF = () => {
    if (!reportData || reportData.length === 0) {
      setToast({ type: 'error', message: 'No data available to export.' });
      return;
    }

    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(16);
    doc.text('BALAJI SAVINGS & FINANCE - VEERAVASARAM', 14, 15);
    doc.setFontSize(10);
    doc.text(`Official Report Statement: ${activeReport.toUpperCase()} REPORT`, 14, 22);
    doc.text(`Generated Date: ${new Date().toLocaleDateString('en-IN')}`, 14, 27);

    let headers = [];
    let rows = [];

    if (activeReport === 'member') {
      headers = [['Code', 'Member Name', 'Email', 'Phone', 'Aadhaar No', 'KYC Status', 'Chit Status']];
      rows = reportData.map((m) => [
        m.member_code || '', m.name || '', m.email || '', m.contact_no_1 || '',
        m.masked_aadhaar || m.aadhaar_no || '', m.kyc_status || 'Verified', m.chit_status || 'Active'
      ]);
    } else if (activeReport === 'chit') {
      headers = [['Code', 'Scheme Name', 'Total Value', 'Duration', 'Members', 'Contribution', 'Foreman %', 'Status']];
      rows = reportData.map((c) => [
        c.scheme_code || '', c.scheme_name || '', formatCurrency(c.total_chit_value), `${c.duration_months} Months`,
        `${c.enrolled_members || 0} / ${c.number_of_members || 0}`, formatCurrency(c.monthly_contribution),
        `${c.foreman_commission_percent || 5}%`, c.status || 'Active'
      ]);
    } else if (activeReport === 'collection') {
      headers = [['Scheme Name', 'Month', 'Member Name', 'Net Due', 'Amount Paid', 'Date', 'Status']];
      rows = reportData.map((p) => [
        p.scheme_name || '', `Month ${p.month_number}`, p.member_name || '',
        formatCurrency(p.net_amount_due), formatCurrency(p.amount_paid),
        p.payment_date ? formatDate(p.payment_date) : 'Pending', p.status || 'Pending'
      ]);
    } else if (activeReport === 'auction') {
      headers = [['Scheme Name', 'Month', 'Winner Name', 'Winning Discount', 'Foreman Comm.', 'Winner Payout', 'Dividend/Member']];
      rows = reportData.map((a) => [
        a.scheme_name || '', `Month ${a.month_number}`, a.winner_name || '',
        formatCurrency(a.winning_bid_discount), formatCurrency(a.foreman_commission),
        formatCurrency(a.winner_payout), formatCurrency(a.dividend_per_member)
      ]);
    } else if (activeReport === 'dividend') {
      headers = [['Scheme Name', 'Month', 'Member Code', 'Member Name', 'Ticket #', 'Dividend Earned']];
      rows = reportData.map((d) => [
        d.scheme_name || '', `Month ${d.month_number}`, d.member_code || '',
        d.member_name || '', d.ticket_number || 1, formatCurrency(d.dividend_amount)
      ]);
    } else if (activeReport === 'pending') {
      headers = [['Scheme Name', 'Month', 'Member Name', 'Phone', 'Net Due', 'Paid', 'Pending Balance']];
      rows = reportData.map((p) => [
        p.scheme_name || '', `Month ${p.month_number}`, p.member_name || '',
        p.contact_no_1 || '', formatCurrency(p.net_amount_due), formatCurrency(p.amount_paid),
        formatCurrency(p.pending_balance)
      ]);
    }

    doc.autoTable({
      head: headers,
      body: rows,
      startY: 32,
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [30, 58, 138], textColor: [255, 255, 255], fontStyle: 'bold' }
    });

    doc.save(`Balaji_ChitFund_${activeReport}_Report_${Date.now()}.pdf`);
    setToast({ type: 'success', message: 'Report exported to PDF successfully.' });
  };

  // Print Report View
  const handlePrint = () => {
    const printElement = document.getElementById('report-printable-table');
    if (!printElement) {
      window.print();
      return;
    }

    const printWindow = window.open('', '_blank', 'width=950,height=700');
    if (!printWindow) {
      window.print();
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Balaji Savings & Finance - ${activeReport.toUpperCase()} Report</title>
          <style>
            body { font-family: sans-serif; padding: 20px; color: #000; }
            h2 { font-size: 18px; margin-bottom: 4px; text-transform: uppercase; color: #1e3a8a; }
            p { font-size: 12px; color: #475569; margin-bottom: 16px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11px; }
            th { background: #1e293b; color: #fff; text-align: left; padding: 8px; border: 1px solid #cbd5e1; }
            td { padding: 8px; border: 1px solid #cbd5e1; }
            tr:nth-child(even) { background: #f8fafc; }
            button, .no-print { display: none !important; }
            @page { size: landscape; margin: 10mm; }
          </style>
        </head>
        <body onload="setTimeout(function(){ window.print(); window.close(); }, 300);">
          <h2>BALAJI SAVINGS & FINANCE - VEERAVASARAM</h2>
          <p>Official Financial Statement &bull; <strong>${activeReport.toUpperCase()} REPORT</strong> &bull; Date: ${new Date().toLocaleDateString('en-IN')}</p>
          ${printElement.outerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
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
            onClick={handleExportExcel}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition"
          >
            <Download className="w-4 h-4" />
            <span>Export Excel</span>
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
          <table className="w-full text-left border-collapse text-xs" id="report-printable-table">
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
                    <th className="p-3 text-right">Proof</th>
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
                    <th className="p-3 text-right">Proof</th>
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
                        <td className="p-3 text-right">
                          {row.proof_image_data ? (
                            <button
                              onClick={() => setProofModalData({ ...row, title: `Collection Payment Proof: ${row.member_name} (Month ${row.month_number})`, image: row.proof_image_data, mode: row.payment_mode, ref: row.reference_no, bank: row.bank_name, cheque: row.cheque_no, cheque_date: row.cheque_date })}
                              className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition"
                              title="View Uploaded Payment Transaction Screenshot"
                            >
                              <Eye className="w-3.5 h-3.5 text-blue-600" />
                              <span>View Proof</span>
                            </button>
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">No Proof</span>
                          )}
                        </td>
                      </>
                    )}

                    {activeReport === 'auction' && (
                      <>
                        <td className="p-3 font-bold text-slate-900">{row.scheme_name}</td>
                        <td className="p-3 font-bold text-blue-600">Month {row.month_number}</td>
                        <td className="p-3 font-bold text-slate-800">{row.winner_name}</td>
                        <td className="p-3 font-semibold text-amber-600">{formatCurrency(row.winning_bid_discount)}</td>
                        <td className="p-3 text-slate-600">{formatCurrency(row.foreman_commission)}</td>
                        <td className="p-3 font-extrabold text-emerald-700">{formatCurrency(row.winner_payout)}</td>
                        <td className="p-3 font-bold text-blue-700">{formatCurrency(row.dividend_per_member)}</td>
                        <td className="p-3 text-right">
                          {row.payout_proof_image ? (
                            <button
                              onClick={() => setProofModalData({ ...row, title: `Auction Winner Payout Proof: ${row.winner_name} (Month ${row.month_number})`, image: row.payout_proof_image, mode: row.payout_mode, ref: row.payout_ref_no, bank: row.payout_bank_name, cheque: row.payout_cheque_no, cheque_date: row.payout_cheque_date })}
                              className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition"
                              title="View Uploaded Auction Payout Screenshot"
                            >
                              <Eye className="w-3.5 h-3.5 text-emerald-600" />
                              <span>View Proof</span>
                            </button>
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">No Proof</span>
                          )}
                        </td>
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

      {/* Transaction Screenshot Proof Modal */}
      {proofModalData && (
        <Modal
          isOpen={!!proofModalData}
          onClose={() => setProofModalData(null)}
          title={proofModalData.title || 'Transaction Screenshot & Details'}
        >
          <div className="space-y-4 text-xs">
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 font-medium text-slate-700">
              <div className="flex justify-between">
                <span>Payment Method:</span>
                <strong className="text-slate-900 uppercase font-bold">{proofModalData.mode || 'Bank Transfer'}</strong>
              </div>
              {proofModalData.ref && (
                <div className="flex justify-between">
                  <span>Transaction UTR / Ref #:</span>
                  <strong className="font-mono text-blue-700">{proofModalData.ref}</strong>
                </div>
              )}
              {proofModalData.bank && (
                <div className="flex justify-between">
                  <span>Bank Name:</span>
                  <strong className="text-slate-900">{proofModalData.bank}</strong>
                </div>
              )}
              {proofModalData.cheque && (
                <div className="flex justify-between">
                  <span>Cheque Number:</span>
                  <strong className="font-mono text-slate-900">{proofModalData.cheque} {proofModalData.cheque_date ? `(${proofModalData.cheque_date})` : ''}</strong>
                </div>
              )}
            </div>

            {proofModalData.image ? (
              <div className="space-y-2">
                <span className="text-[11px] font-bold text-slate-500 block uppercase tracking-wider">Uploaded Transaction Screenshot / Photo:</span>
                <div className="p-2 bg-slate-900 rounded-2xl flex justify-center items-center overflow-hidden border border-slate-800">
                  <img
                    src={proofModalData.image}
                    alt="Transaction Proof"
                    className="max-h-[420px] w-auto object-contain rounded-xl shadow-lg"
                  />
                </div>
              </div>
            ) : (
              <div className="p-6 text-center text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                No screenshot file was attached to this transaction.
              </div>
            )}
          </div>
        </Modal>
      )}

    </div>
  );
}

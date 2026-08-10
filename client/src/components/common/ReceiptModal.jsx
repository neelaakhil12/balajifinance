import React, { useRef, useState } from 'react';
import Modal from './Modal';
import { formatDecimal, numberToWordsRupees } from '../../utils/formatters';
import { Printer, Download, Loader2 } from 'lucide-react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

export default function ReceiptModal({ isOpen, onClose, payment }) {
  const receiptRef = useRef(null);
  const [downloading, setDownloading] = useState(false);

  if (!payment) return null;

  // Extract variables to match exact physical slip format
  const schemeCodeStr = payment.scheme_code || 'BSF-SCH-1003';
  const schemeNameStr = payment.scheme_name || '3,00,000 Chit Scheme';
  
  // Clean scheme header line: BSF-SCH-1003 - ₹3,00,000
  const schemeValFormatted = payment.total_chit_value ? `₹${Number(payment.total_chit_value).toLocaleString('en-IN')}` : '₹3,00,000';
  const schemeHeaderLine = `${schemeCodeStr} - ${schemeValFormatted}`;

  const rawMemberCode = payment.member_code
    ? String(payment.member_code).replace('BSF-MBR-', '')
    : '1006';

  const memberName = String(payment.member_name || 'KAVITHA REDDY').toUpperCase();
  const displayName = memberName.startsWith('SRI') || memberName.startsWith('SMT') ? memberName : `Sri ${memberName}`;

  // Format date: DD/MM/YYYY
  let formattedDate = '09/08/2026';
  if (payment.payment_date) {
    const d = new Date(payment.payment_date);
    if (!isNaN(d.getTime())) {
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      formattedDate = `${day}/${month}/${year}`;
    }
  } else {
    const d = new Date();
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    formattedDate = `${day}/${month}/${year}`;
  }

  const instalmentNo = payment.month_number || 1;
  const savingAmount = Number(payment.base_contribution || 5000);
  const lessInterest = Number(payment.dividend_applied || 0);

  const netDueVal = Number(payment.net_amount_due || (savingAmount - lessInterest));
  const amountPaidVal = Number(payment.amount_paid || 0);
  const balanceDueVal = Math.max(0, netDueVal - amountPaidVal);
  
  // Total cumulative interest earned
  const totInterestVal = lessInterest * Math.max(1, instalmentNo);

  const displayVal = amountPaidVal > 0 ? amountPaidVal : netDueVal;
  const amountInWords = `Rs ${numberToWordsRupees(displayVal)}`;

  const handlePrint = () => {
    if (!receiptRef.current) return;
    const printContent = receiptRef.current.innerHTML;

    const printWindow = window.open('', '_blank', 'width=450,height=650');
    if (!printWindow) {
      window.print();
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Intimation Receipt - ${rawMemberCode}</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body {
              padding: 10px;
              font-family: 'Courier New', Courier, monospace;
              color: #000000;
              background-color: #ffffff;
            }
            .thermal-slip {
              width: 280px;
              margin: 0 auto;
              padding: 8px;
            }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .font-bold { font-weight: 700; }
            .uppercase { text-transform: uppercase; }
            .flex { display: flex; justify-content: space-between; }
            .border-dashed-line {
              border-bottom: 1px dashed #000000;
              margin: 6px 0;
            }
            .w-half { width: 50%; }
            .text-xs { font-size: 11px; line-height: 1.4; }
            .text-sm { font-size: 13px; line-height: 1.4; }
            .break-words { word-break: break-word; overflow-wrap: anywhere; }
            @page {
              size: 80mm auto;
              margin: 0mm;
            }
          </style>
        </head>
        <body onload="setTimeout(function(){ window.print(); window.close(); }, 300);">
          <div class="thermal-slip">
            ${printContent}
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleDownloadPDF = async () => {
    try {
      setDownloading(true);

      // Create an isolated HTML element with pure hex colors (no oklch CSS color bugs)
      const container = document.createElement('div');
      container.style.position = 'fixed';
      container.style.left = '-9999px';
      container.style.top = '-9999px';
      container.style.width = '320px';
      container.style.backgroundColor = '#ffffff';

      container.innerHTML = `
        <div style="width: 285px; margin: 0 auto; padding: 12px; background: #ffffff; color: #000000; font-family: 'Courier New', Courier, monospace; box-sizing: border-box; line-height: 1.35;">
          
          <div style="text-align: center; font-weight: bold; text-transform: uppercase; font-size: 12px; letter-spacing: 0.5px;">
            <div style="font-weight: 800; font-size: 13px;">BALAJI SAVINGS & FINANCE</div>
            <div style="font-size: 11px;">VEERAVASARAM</div>
            <div style="font-size: 10px; font-weight: normal; letter-spacing: 2px; padding-top: 2px;">I N T I M A T I O N</div>
          </div>

          <div style="margin-top: 12px; font-size: 11px;">
            <div style="font-weight: bold; text-transform: uppercase; font-size: 12px;">${schemeHeaderLine}</div>
            <div style="display: flex; justify-content: space-between; margin-top: 3px;">
              <span>Member Code: <strong>${rawMemberCode}</strong></span>
              <span>Date : <strong>${formattedDate}</strong></span>
            </div>
            <div style="font-weight: bold; text-transform: uppercase; margin-top: 4px; font-size: 12px;">${displayName}</div>
          </div>

          <div style="border-bottom: 1px dashed #000000; margin: 8px 0;"></div>

          <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 11px;">
            <span>Instalment No:</span>
            <span style="font-size: 13px; font-weight: 800; color: #1e3a8a;">${instalmentNo}</span>
          </div>

          <div style="border-bottom: 1px dashed #000000; margin: 8px 0;"></div>

          <div style="font-size: 11px;">
            <div style="display: flex; justify-content: space-between;">
              <span style="color: #334155; width: 38%;">Tot Interest</span>
              <div style="display: flex; justify-content: space-between; width: 62%;">
                <span>Monthly Due</span>
                <span style="font-weight: bold;">${formatDecimal(savingAmount)}</span>
              </div>
            </div>

            <div style="display: flex; justify-content: space-between; margin-top: 3px;">
              <span style="font-weight: bold; width: 38%;">Rs ${formatDecimal(totInterestVal)}</span>
              <div style="display: flex; justify-content: space-between; width: 62%;">
                <span>Less Dividend</span>
                <span style="font-weight: bold;">-${formatDecimal(lessInterest)}</span>
              </div>
            </div>

            <div style="display: flex; justify-content: flex-end; margin-top: 4px;">
              <div style="display: flex; justify-content: space-between; width: 62%; font-weight: bold; font-size: 11px; border-top: 1px solid #cbd5e1; padding-top: 2px;">
                <span>Net Amount Due</span>
                <span style="font-weight: 800; color: #1e3a8a;">${formatDecimal(netDueVal)}</span>
              </div>
            </div>

            <div style="display: flex; justify-content: flex-end; margin-top: 3px;">
              <div style="display: flex; justify-content: space-between; width: 62%;">
                <span>Amount Paid</span>
                <span style="font-weight: bold; color: #047857;">${formatDecimal(amountPaidVal)}</span>
              </div>
            </div>

            <div style="display: flex; justify-content: flex-end; margin-top: 4px;">
              <div style="display: flex; justify-content: space-between; width: 62%; font-weight: bold; font-size: 11px; border-top: 1px solid #94a3b8; padding-top: 3px;">
                <span>Balance Due</span>
                <span style="font-weight: 800; color: #881337;">${formatDecimal(balanceDueVal)}</span>
              </div>
            </div>
          </div>

          <div style="border-bottom: 1px dashed #000000; margin: 8px 0;"></div>

          <div style="font-weight: bold; font-size: 10px; text-transform: uppercase;">
            ${amountInWords}
          </div>

          <div style="margin-top: 18px; text-align: right; font-weight: bold; font-size: 10px;">
            For BALAJI SAVINGS & FINANCE
          </div>

        </div>
      `;

      document.body.appendChild(container);

      const canvas = await html2canvas(container.firstElementChild, {
        scale: 3,
        backgroundColor: '#ffffff',
        logging: false
      });

      document.body.removeChild(container);

      const imgData = canvas.toDataURL('image/png');
      const pdfWidth = 80; // 80mm thermal paper width
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      const pdf = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: [pdfWidth, pdfHeight]
      });

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Intimation_Receipt_${rawMemberCode}_Instalment${instalmentNo}.pdf`);
    } catch (err) {
      console.error('PDF Generation failed:', err);
      alert('Failed to generate PDF. Please use the Print option.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Official Intimation Payment Receipt">
      <div className="space-y-6 text-xs">
        
        {/* Exact Physical Thermal Receipt Card Container */}
        <div className="flex justify-center bg-slate-100 p-3 rounded-xl overflow-x-auto">
          <div
            ref={receiptRef}
            id="printable-receipt-card"
            className="w-[280px] shrink-0 bg-white border border-slate-300 p-4 shadow-sm font-mono text-[11px] leading-tight text-slate-900 break-words"
            style={{ fontFamily: "'Courier New', Courier, monospace" }}
          >
            {/* Header */}
            <div className="text-center font-bold tracking-tight uppercase space-y-0.5">
              <p className="text-[12px] font-extrabold">BALAJI SAVINGS & FINANCE</p>
              <p className="text-[10px]">VEERAVASARAM</p>
              <p className="text-[10px] font-normal tracking-[0.2em] pt-0.5">I N T I M A T I O N</p>
            </div>

            {/* Scheme & Member Metadata */}
            <div className="mt-3 space-y-0.5">
              <p className="font-bold uppercase text-[11px] break-words">{schemeHeaderLine}</p>
              <div className="flex justify-between items-center text-[10px]">
                <span>Member Code: <strong className="font-bold">{rawMemberCode}</strong></span>
                <span>Date : <strong>{formattedDate}</strong></span>
              </div>
              <p className="font-bold uppercase pt-1 text-[12px] break-words">{displayName}</p>
            </div>

            {/* Dotted Divider */}
            <div className="border-b border-dashed border-slate-900 my-2"></div>

            {/* Instalment No */}
            <div className="flex items-center justify-between font-bold text-[11px]">
              <span>Instalment No:</span>
              <span className="text-[13px] text-blue-900 font-extrabold">{instalmentNo}</span>
            </div>

            {/* Dotted Divider */}
            <div className="border-b border-dashed border-slate-900 my-2"></div>

            {/* Financial Grid Layout */}
            <div className="space-y-1 text-[10px]">
              <div className="flex justify-between items-start">
                <span className="text-slate-700 w-[38%]">Tot Interest</span>
                <div className="flex justify-between w-[62%] font-mono">
                  <span>Monthly Due</span>
                  <span className="font-bold">{formatDecimal(savingAmount)}</span>
                </div>
              </div>

              <div className="flex justify-between items-start">
                <span className="font-bold w-[38%]">Rs {formatDecimal(totInterestVal)}</span>
                <div className="flex justify-between w-[62%] font-mono">
                  <span>Less Dividend</span>
                  <span className="font-bold">-{formatDecimal(lessInterest)}</span>
                </div>
              </div>

              <div className="pt-0.5 flex justify-end">
                <div className="flex justify-between w-[62%] font-mono font-bold text-[11px] border-t border-slate-300 pt-0.5">
                  <span>Net Amount Due</span>
                  <span className="text-blue-900 font-extrabold">{formatDecimal(netDueVal)}</span>
                </div>
              </div>

              <div className="flex justify-end">
                <div className="flex justify-between w-[62%] font-mono">
                  <span>Amount Paid</span>
                  <span className="font-bold text-emerald-700">{formatDecimal(amountPaidVal)}</span>
                </div>
              </div>

              <div className="pt-0.5 flex justify-end">
                <div className="flex justify-between w-[62%] font-mono font-bold text-[11px] border-t border-slate-400 pt-0.5">
                  <span>Balance Due</span>
                  <span className="text-rose-900 font-extrabold">{formatDecimal(balanceDueVal)}</span>
                </div>
              </div>
            </div>

            {/* Dotted Divider */}
            <div className="border-b border-dashed border-slate-900 my-2"></div>

            {/* Amount in Words */}
            <p className="font-bold text-[10px] uppercase tracking-tight break-words">
              {amountInWords}
            </p>

            {/* Payment Mode & Reference / Proof Details */}
            <div className="mt-2 pt-1 border-t border-dashed border-slate-900 text-[10px] space-y-0.5">
              <div className="flex justify-between">
                <span>Mode: <strong className="uppercase">{payment.payment_mode || 'UPI'}</strong></span>
                {payment.reference_no && (
                  <span className="font-mono">Ref: <strong>{payment.reference_no}</strong></span>
                )}
              </div>
              {payment.bank_name && (
                <p>Bank: <strong>{payment.bank_name}</strong></p>
              )}
              {payment.cheque_no && (
                <p>Cheque #: <strong>{payment.cheque_no}</strong> {payment.cheque_date ? `(${payment.cheque_date})` : ''}</p>
              )}
              {payment.proof_image_data && (
                <div className="mt-2 text-center">
                  <span className="text-[9px] text-slate-500 font-bold block mb-0.5">ATTACHED PAYMENT PROOF SCREENSHOT</span>
                  <img
                    src={payment.proof_image_data}
                    alt="Payment Proof Screenshot"
                    className="w-full max-h-36 object-contain rounded-lg border border-slate-300"
                  />
                </div>
              )}
            </div>

            {/* Footer Sign */}
            <div className="mt-4 text-right font-bold text-[10px]">
              <p>For BALAJI SAVINGS & FINANCE</p>
            </div>

          </div>
        </div>

        {/* Action Controls */}
        <div className="flex justify-end gap-3 print:hidden">
          <button
            type="button"
            onClick={handlePrint}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl flex items-center gap-2 shadow-xs"
          >
            <Printer className="w-4 h-4 text-emerald-400" />
            Print Intimation Slip
          </button>

          <button
            type="button"
            onClick={handleDownloadPDF}
            disabled={downloading}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl flex items-center gap-2 shadow-md shadow-emerald-600/20 disabled:opacity-50"
          >
            {downloading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating PDF...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Download Thermal PDF
              </>
            )}
          </button>
        </div>

      </div>
    </Modal>
  );
}

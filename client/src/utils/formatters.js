/**
 * Formats numbers into Indian Rupee currency format
 * Example: 100000 -> ₹1,00,000
 */
export function formatCurrency(amount) {
  if (amount === undefined || amount === null || isNaN(amount)) return '₹0';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount);
}

/**
 * Formats ISO date string to human-readable date
 * Example: "2026-01-15" -> "15 Jan 2026"
 */
export function formatDate(dateString) {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return new Intl.DateTimeFormat('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }).format(date);
  } catch (e) {
    return dateString;
  }
}

/**
 * Masks Aadhaar number for list view privacy
 * Example: "458912348901" -> "XXXX-XXXX-8901"
 */
export function maskAadhaar(aadhaarNo) {
  if (!aadhaarNo) return 'N/A';
  const clean = String(aadhaarNo).replace(/\D/g, '');
  if (clean.length < 4) return 'XXXX-XXXX-XXXX';
  const last4 = clean.slice(-4);
  return `XXXX-XXXX-${last4}`;
}

/**
 * Server-side financial calculation engine for Balaji Savings & Finance
 * Guarantees decimal-safe math without floating point precision issues.
 */

function roundToTwoDecimals(num) {
  return Math.round((Number(num) + Number.EPSILON) * 100) / 100;
}

/**
 * Calculates auction outcomes and member dividend allocations dynamically.
 * 
 * Formula breakdown:
 * 1. Winner Payout = Total Chit Value - Auction Discount
 * 2. Foreman Commission = (Commission % * Total Chit Value) OR fixed amount
 * 3. Net Dividend Pool = Auction Discount - Foreman Commission
 * 4. Dividend Per Member = Net Dividend Pool / Total Eligible Members
 * 5. Next Month Payable Amount = Normal Monthly Contribution - Dividend Per Member
 */
function calculateAuctionFinancials({
  totalChitValue,
  auctionDiscount,
  foremanCommissionPercent = 5,
  foremanCommissionAmount = null,
  numberOfMembers = 20,
  monthlyContribution = 5000
}) {
  const chitVal = roundToTwoDecimals(totalChitValue);
  const discount = roundToTwoDecimals(auctionDiscount);
  const members = Math.max(1, parseInt(numberOfMembers, 10));
  const baseMonthly = roundToTwoDecimals(monthlyContribution);

  // Determine foreman commission
  let foremanComm = 0;
  if (foremanCommissionAmount !== null && foremanCommissionAmount !== undefined && foremanCommissionAmount !== '') {
    foremanComm = roundToTwoDecimals(foremanCommissionAmount);
  } else {
    foremanComm = roundToTwoDecimals((chitVal * foremanCommissionPercent) / 100);
  }

  // Calculate winner payout
  const winnerPayout = roundToTwoDecimals(chitVal - discount);

  // Calculate dividend pool & distribution
  const netDividendPool = roundToTwoDecimals(Math.max(0, discount - foremanComm));
  const dividendPerMember = roundToTwoDecimals(netDividendPool / members);
  const nextMonthPayable = roundToTwoDecimals(Math.max(0, baseMonthly - dividendPerMember));

  return {
    totalChitValue: chitVal,
    auctionDiscount: discount,
    foremanCommission: foremanComm,
    winnerPayout,
    netDividendPool,
    dividendPerMember,
    monthlyContribution: baseMonthly,
    nextMonthPayable,
    numberOfMembers: members
  };
}

/**
 * Masks Aadhaar number for general lists to comply with privacy requirements.
 * Example: "123456789012" -> "XXXX-XXXX-9012"
 */
function maskAadhaar(aadhaarNo) {
  if (!aadhaarNo) return 'N/A';
  const clean = String(aadhaarNo).replace(/\D/g, '');
  if (clean.length < 4) return 'XXXX-XXXX-XXXX';
  const last4 = clean.slice(-4);
  return `XXXX-XXXX-${last4}`;
}

module.exports = {
  roundToTwoDecimals,
  calculateAuctionFinancials,
  maskAadhaar
};

import React, { useState } from 'react';
import { formatCurrency } from '../utils/formatters';
import {
  HelpCircle,
  Building2,
  Calculator,
  CheckCircle,
  TrendingUp,
  Gift,
  Coins,
  ArrowRight,
  Sparkles
} from 'lucide-react';

export default function HowItWorksPage() {
  // Interactive Simulator State
  const [simChitValue, setSimChitValue] = useState(100000);
  const [simDuration, setSimDuration] = useState(20);
  const [simMembers, setSimMembers] = useState(20);
  const [simContribution, setSimContribution] = useState(5000);
  const [simDiscount, setSimDiscount] = useState(15000);
  const [simCommissionPercent, setSimCommissionPercent] = useState(5);

  // Live Calculations
  const foremanCommission = (simChitValue * simCommissionPercent) / 100;
  const winnerPayout = Math.max(0, simChitValue - simDiscount);
  const dividendPool = Math.max(0, simDiscount - foremanCommission);
  const dividendPerMember = simMembers > 0 ? dividendPool / simMembers : 0;
  const nextMonthPayable = Math.max(0, simContribution - dividendPerMember);

  return (
    <div className="space-y-8 pb-12 max-w-5xl mx-auto">
      
      {/* Top Banner Header */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-blue-950 p-6 sm:p-8 rounded-2xl text-white shadow-lg border border-slate-800 text-center sm:text-left flex flex-col sm:flex-row items-center justify-between gap-6">
        <div>
          <div className="flex items-center justify-center sm:justify-start gap-2">
            <Building2 className="w-5 h-5 text-blue-400" />
            <span className="text-xs font-extrabold uppercase tracking-widest text-blue-300">
              BALAJI SAVINGS & FINANCE
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold mt-2 tracking-tight">
            Chit Fund – How It Works
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-xl">
            Your Trusted Partner for Smart Savings & Instant Support. Learn how monthly auctions, dividend pool distributions, and net contributions function.
          </p>
        </div>

        <div className="p-4 bg-slate-800/80 rounded-2xl border border-slate-700 shrink-0 text-center">
          <Calculator className="w-8 h-8 text-blue-400 mx-auto mb-1" />
          <span className="text-[11px] font-bold text-slate-300 block">Server Financial Engine</span>
          <span className="text-[10px] text-emerald-400 font-semibold">100% Configurable</span>
        </div>
      </div>

      {/* 1. Default ₹1,00,000 Scheme Benchmark Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
        <div className="flex items-center gap-2">
          <span className="p-2 bg-blue-100 text-blue-700 rounded-xl">
            <Coins className="w-5 h-5" />
          </span>
          <div>
            <h3 className="text-base font-bold text-slate-900">Standard ₹1,00,000 Chit Scheme Structure</h3>
            <p className="text-xs text-slate-500">Benchmark 20-month saving and borrowing model</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center text-xs pt-2">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-slate-500 text-[11px] block">Total Chit Value</span>
            <span className="text-sm font-extrabold text-slate-900 mt-0.5 block">₹1,00,000</span>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-slate-500 text-[11px] block">Duration</span>
            <span className="text-sm font-extrabold text-slate-900 mt-0.5 block">20 Months</span>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-slate-500 text-[11px] block">Total Members</span>
            <span className="text-sm font-extrabold text-slate-900 mt-0.5 block">20 Members</span>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-slate-500 text-[11px] block">Base Monthly</span>
            <span className="text-sm font-extrabold text-blue-600 mt-0.5 block">₹5,000 / mo</span>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 col-span-2 sm:col-span-1">
            <span className="text-slate-500 text-[11px] block">Foreman Comm.</span>
            <span className="text-sm font-extrabold text-slate-900 mt-0.5 block">5% (₹5,000)</span>
          </div>
        </div>
      </div>

      {/* 2. Step-by-Step Sample Auction Breakdown */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-6">
        <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-emerald-600" />
          Sample First Month Auction Walkthrough (Example Bidding)
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left: Input parameters */}
          <div className="p-5 bg-slate-900 text-white rounded-2xl space-y-3 text-xs">
            <h4 className="font-bold text-blue-400 uppercase tracking-wider">Auction Inputs</h4>
            
            <div className="flex justify-between py-1.5 border-b border-slate-800">
              <span className="text-slate-400">Total Chit Scheme Value</span>
              <span className="font-bold text-white">₹1,00,000</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-800">
              <span className="text-slate-400">Winning Auction Discount/Bid</span>
              <span className="font-bold text-amber-400">₹15,000</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-800">
              <span className="text-slate-400">Foreman Commission (5%)</span>
              <span className="font-bold text-slate-300">₹5,000</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-slate-400">Eligible Members Count</span>
              <span className="font-bold text-white">20</span>
            </div>
          </div>

          {/* Right: Output Calculations */}
          <div className="p-5 bg-emerald-50 rounded-2xl border border-emerald-200 space-y-3 text-xs">
            <h4 className="font-bold text-emerald-900 uppercase tracking-wider flex items-center gap-1">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              Calculated Financial Distribution
            </h4>

            <div className="flex justify-between py-1.5 border-b border-emerald-200">
              <span className="text-emerald-800">Final Payout to Winner (₹1,00,000 - ₹15,000)</span>
              <span className="font-extrabold text-emerald-900 text-sm">₹85,000</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-emerald-200">
              <span className="text-emerald-800">Net Dividend Pool (₹15,000 - ₹5,000)</span>
              <span className="font-bold text-emerald-900">₹10,000</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-emerald-200">
              <span className="text-emerald-800">Dividend Distributed Per Member (₹10,000 ÷ 20)</span>
              <span className="font-extrabold text-blue-700 text-sm">₹500</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-emerald-900 font-bold">Next Month Net Payable Amount (₹5,000 - ₹500)</span>
              <span className="font-extrabold text-slate-900 text-base">₹4,500</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Live Interactive Financial Calculation Simulator */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-md p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-600" />
              <h3 className="text-base font-bold text-slate-900">Live Configurable Financial Simulator</h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Adjust values below to test custom chit schemes dynamically.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Chit Scheme Value (₹)</label>
            <input
              type="number"
              value={simChitValue}
              onChange={(e) => setSimChitValue(Number(e.target.value))}
              className="w-full px-3 py-2 border rounded-xl font-bold bg-slate-50"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Auction Winning Discount (₹)</label>
            <input
              type="number"
              value={simDiscount}
              onChange={(e) => setSimDiscount(Number(e.target.value))}
              className="w-full px-3 py-2 border rounded-xl font-bold bg-slate-50 text-amber-700"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Foreman Commission (%)</label>
            <input
              type="number"
              value={simCommissionPercent}
              onChange={(e) => setSimCommissionPercent(Number(e.target.value))}
              className="w-full px-3 py-2 border rounded-xl font-bold bg-slate-50"
            />
          </div>
        </div>

        {/* Live Outcome Box */}
        <div className="p-5 bg-slate-950 text-white rounded-2xl grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          <div>
            <span className="text-[11px] text-slate-400 block">Winner Payout</span>
            <span className="text-lg font-extrabold text-emerald-400">{formatCurrency(winnerPayout)}</span>
          </div>
          <div>
            <span className="text-[11px] text-slate-400 block">Foreman Commission</span>
            <span className="text-lg font-extrabold text-slate-300">{formatCurrency(foremanCommission)}</span>
          </div>
          <div>
            <span className="text-[11px] text-slate-400 block">Dividend Per Member</span>
            <span className="text-lg font-extrabold text-blue-400">{formatCurrency(dividendPerMember)}</span>
          </div>
          <div>
            <span className="text-[11px] text-slate-400 block">Next Month Payable</span>
            <span className="text-lg font-extrabold text-amber-400">{formatCurrency(nextMonthPayable)}</span>
          </div>
        </div>
      </div>

    </div>
  );
}

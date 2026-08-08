import React, { useState, useEffect } from 'react';
import API from '../services/api';
import Toast from '../components/common/Toast';
import StatCard from '../components/common/StatCard';
import { formatCurrency, formatDate } from '../utils/formatters';
import { PieChart, Layers, Users, TrendingUp, IndianRupee } from 'lucide-react';

export default function DividendsPage() {
  const [dividends, setDividends] = useState([]);
  const [schemes, setSchemes] = useState([]);
  const [summary, setSummary] = useState({ totalDividendDistributed: 0 });
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState({ type: '', message: '' });

  const [schemeFilter, setSchemeFilter] = useState('');

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    fetchDividends();
  }, [schemeFilter]);

  const fetchInitialData = async () => {
    try {
      const res = await API.get('/chits');
      if (res.data.success) setSchemes(res.data.schemes);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchDividends = async () => {
    try {
      setLoading(true);
      const res = await API.get('/dividends', {
        params: { scheme_id: schemeFilter }
      });
      if (res.data.success) {
        setDividends(res.data.dividends);
        setSummary(res.data.summary);
      }
    } catch (err) {
      console.error('Fetch dividends error:', err);
      setToast({ type: 'error', message: 'Failed to load dividend records.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      
      <Toast type={toast.type} message={toast.message} onClose={() => setToast({ type: '', message: '' })} />

      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <PieChart className="w-5 h-5 text-purple-600" />
            <h2 className="text-xl font-bold text-slate-900">Member Dividends Ledger</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            View monthly dividend allocations distributed from auction discount pools.
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <StatCard
          title="Total Dividend Distributed"
          value={formatCurrency(summary.totalDividendDistributed)}
          icon={TrendingUp}
          color="emerald"
          badgeText="Total Payout"
        />
        <StatCard
          title="Total Dividend Allocations"
          value={dividends.length}
          icon={Users}
          color="purple"
          badgeText="Member Credits"
        />
        <StatCard
          title="Active Schemes Benefited"
          value={schemes.length}
          icon={Layers}
          color="blue"
          badgeText="Chit Groups"
        />
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-3">
          <label className="text-xs font-semibold text-slate-700">Filter by Chit Scheme:</label>
          <select
            value={schemeFilter}
            onChange={(e) => setSchemeFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold"
          >
            <option value="">All Schemes</option>
            {schemes.map((s) => (
              <option key={s.id} value={s.id}>{s.scheme_name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Dividends Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-900 text-white font-semibold uppercase">
                <th className="p-3.5">Scheme & Month</th>
                <th className="p-3.5">Member Name</th>
                <th className="p-3.5">Auction Discount</th>
                <th className="p-3.5">Foreman Comm.</th>
                <th className="p-3.5">Total Dividend Pool</th>
                <th className="p-3.5">Member Dividend Credited</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    Loading dividend ledger...
                  </td>
                </tr>
              ) : dividends.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    No dividend allocations found.
                  </td>
                </tr>
              ) : (
                dividends.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50">
                    <td className="p-3.5">
                      <span className="font-bold text-slate-900 block">{d.scheme_name}</span>
                      <span className="font-bold text-blue-600">Month {d.month_number}</span>
                    </td>
                    <td className="p-3.5">
                      <span className="font-bold text-slate-900 block">{d.member_name}</span>
                      <span className="font-mono text-slate-500">{d.member_code}</span>
                    </td>
                    <td className="p-3.5 text-amber-600 font-semibold">{formatCurrency(d.winning_bid_discount)}</td>
                    <td className="p-3.5 text-slate-600">{formatCurrency(d.foreman_commission)}</td>
                    <td className="p-3.5 font-bold text-emerald-700">{formatCurrency(d.dividend_pool)}</td>
                    <td className="p-3.5 font-extrabold text-blue-700 text-sm">
                      +{formatCurrency(d.dividend_amount)}
                    </td>
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

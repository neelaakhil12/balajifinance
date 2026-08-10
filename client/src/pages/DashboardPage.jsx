import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import API from '../services/api';
import StatCard from '../components/common/StatCard';
import { formatCurrency, formatDate } from '../utils/formatters';
import {
  Users,
  Layers,
  IndianRupee,
  TrendingUp,
  PieChart as PieIcon,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  Gavel,
  UserPlus,
  CreditCard
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const res = await API.get('/reports/dashboard');
      if (res.data.success) {
        setData(res.data);
      }
    } catch (err) {
      console.error('Fetch dashboard failed:', err);
      setError('Failed to load dashboard statistics.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-medium text-slate-600">Loading Balaji Financial Dashboard...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 bg-rose-50 text-rose-700 rounded-xl border border-rose-200">
        <p className="font-semibold">{error || 'Failed to connect to backend server.'}</p>
        <button
          onClick={fetchDashboardData}
          className="mt-3 px-4 py-2 bg-rose-600 text-white text-xs font-semibold rounded-lg shadow-xs hover:bg-rose-500"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  const { summary, recentMembers, activeSchemes, recentAuctions, recentActivity, charts } = data;

  const COLORS = ['#2563EB', '#10B981', '#F59E0B', '#8B5CF6'];

  return (
    <div className="space-y-8 pb-12">
      
      {/* Top Banner Header */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-blue-950 p-6 sm:p-8 rounded-2xl text-white shadow-lg border border-slate-800 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div>
          <span className="px-3 py-1 bg-blue-600/30 text-blue-300 border border-blue-500/30 rounded-full text-xs font-bold uppercase tracking-wider">
            Executive Summary
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold mt-2 tracking-tight">
            Balaji Chit Fund Dashboard
          </h2>
          <p className="text-slate-300 text-xs sm:text-sm mt-1">
            Real-time financial status, member collection ledger, and auction distributions.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <Link
            to="/add-member"
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/30 transition"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add New Member</span>
          </Link>
          <Link
            to="/auctions"
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/30 transition"
          >
            <Gavel className="w-4 h-4" />
            <span>Conduct Auction</span>
          </Link>
        </div>
      </div>

      {/* 1. Summary Stat Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          title="Total Members"
          value={summary.totalMembers}
          icon={Users}
          color="blue"
          badgeText="Active Roster"
        />
        <StatCard
          title="Active Chit Schemes"
          value={summary.activeChitSchemes}
          icon={Layers}
          color="indigo"
          badgeText="Enrolled"
        />
        <StatCard
          title="Total Chit Value"
          value={formatCurrency(summary.totalChitValue)}
          icon={IndianRupee}
          color="emerald"
          badgeText="Active Portfolio"
        />
        <StatCard
          title="Total Collections"
          value={formatCurrency(summary.currentMonthCollection)}
          icon={TrendingUp}
          color="blue"
          badgeText="Collected Dues"
        />
        <StatCard
          title="Total Dividends"
          value={formatCurrency(summary.currentMonthDividend)}
          icon={PieIcon}
          color="purple"
          badgeText="Distributed"
        />
        <StatCard
          title="Pending Payments"
          value={formatCurrency(summary.pendingPayments)}
          icon={AlertCircle}
          color="amber"
          badgeText="Outstanding"
        />
        <StatCard
          title="Completed Chits"
          value={summary.completedChits}
          icon={CheckCircle2}
          color="rose"
          badgeText="Closed Schemes"
        />
      </div>

      {/* 2. Visual Analytics & Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Collection & Targets Bar Chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-base font-bold text-slate-900">Monthly Collections & Dues</h3>
              <p className="text-xs text-slate-500">Track target dues vs actual collected payments by month</p>
            </div>
            <CreditCard className="w-5 h-5 text-blue-600" />
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts.collectionsChart || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="month_number" tickFormatter={(m) => `Month ${m}`} tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(val) => `₹${val/1000}k`} tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(val) => [formatCurrency(val), 'Amount']}
                  labelFormatter={(m) => `Month ${m}`}
                  contentStyle={{ backgroundColor: '#0F172A', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                />
                <Bar dataKey="target" fill="#E2E8F0" radius={[4, 4, 0, 0]} name="Target Due" />
                <Bar dataKey="collected" fill="#2563EB" radius={[4, 4, 0, 0]} name="Collected Amount" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chit Scheme Status Pie Chart */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">Chit Schemes Breakdown</h3>
            <p className="text-xs text-slate-500">Distribution by status</p>
          </div>

          <div className="h-56 my-2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={charts.chitsStatusChart || []}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {(charts.chitsStatusChart || []).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#0F172A', borderRadius: '8px', color: '#fff', fontSize: '12px' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* 3. Detailed Data Tables Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Active Chit Schemes Roster */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Active Chit Schemes</h3>
            <Link to="/schemes" className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1">
              View All <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="divide-y divide-slate-100">
            {activeSchemes.length === 0 ? (
              <p className="p-4 text-xs text-slate-500 text-center">No active schemes found.</p>
            ) : (
              activeSchemes.map((sch) => (
                <div key={sch.id} className="p-4 hover:bg-slate-50 transition flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">{sch.scheme_name}</h4>
                    <p className="text-xs text-slate-500">
                      Value: <span className="font-semibold text-slate-700">{formatCurrency(sch.total_chit_value)}</span> • {sch.duration_months} Months
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {sch.enrolled_members_count}/{sch.number_of_members} Members
                    </span>
                    <p className="text-[11px] text-slate-400 mt-1">{formatCurrency(sch.monthly_contribution)} / mo</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Auction Results */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Recent Auction Results</h3>
            <Link to="/auctions" className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1">
              View All <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="divide-y divide-slate-100">
            {recentAuctions.length === 0 ? (
              <p className="p-4 text-xs text-slate-500 text-center">No auction records yet.</p>
            ) : (
              recentAuctions.map((auc) => (
                <div key={auc.id} className="p-4 hover:bg-slate-50 transition flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-blue-600">Month {auc.month_number}</span>
                      <span className="text-xs font-medium text-slate-700">{auc.scheme_name}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Winner: <span className="font-semibold text-slate-900">{auc.winner_name}</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-extrabold text-emerald-600">{formatCurrency(auc.winner_payout)}</p>
                    <p className="text-[11px] text-slate-500">Div/Member: {formatCurrency(auc.dividend_per_member)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>



    </div>
  );
}

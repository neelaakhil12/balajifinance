import React, { useState, useEffect } from 'react';
import API from '../services/api';
import { useAuth } from '../context/AuthContext';
import { formatDate } from '../utils/formatters';
import { Settings, ShieldCheck, Activity, User, Building2, Lock, CheckCircle2 } from 'lucide-react';

export default function SettingsPage() {
  const { user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAuditLogs();
  }, []);

  const fetchAuditLogs = async () => {
    try {
      setLoading(true);
      const res = await API.get('/audit?limit=50');
      if (res.data.success) {
        setLogs(res.data.logs);
      }
    } catch (err) {
      console.error('Fetch audit logs error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-12 max-w-5xl mx-auto">
      
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-blue-600" />
          <h2 className="text-xl font-bold text-slate-900">Settings & Security Audit Logs</h2>
        </div>
      </div>

      {/* Staff Account & System Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Account Info */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-bold text-slate-900 uppercase">Authenticated Staff User</h3>
          </div>

          <div className="space-y-2 text-xs">
            <div className="p-3 bg-slate-50 rounded-xl flex justify-between">
              <span className="text-slate-500">Staff Name</span>
              <span className="font-bold text-slate-900">{user?.name}</span>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl flex justify-between">
              <span className="text-slate-500">Email Address</span>
              <span className="font-bold text-slate-900">{user?.email}</span>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl flex justify-between">
              <span className="text-slate-500">Staff Role</span>
              <span className="font-bold text-emerald-700 uppercase">{user?.role}</span>
            </div>
          </div>
        </div>

        {/* Security & System Info */}
        <div className="bg-slate-900 text-white p-6 rounded-2xl border border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white uppercase">System Security Config</h3>
          </div>

          <div className="space-y-2 text-xs">
            <div className="p-3 bg-slate-800/80 rounded-xl flex justify-between">
              <span className="text-slate-400">Password Hashing</span>
              <span className="font-bold text-emerald-400">BCrypt 10 Salt Rounds</span>
            </div>
            <div className="p-3 bg-slate-800/80 rounded-xl flex justify-between">
              <span className="text-slate-400">KYC Storage</span>
              <span className="font-bold text-emerald-400">Auth Token Protected</span>
            </div>
            <div className="p-3 bg-slate-800/80 rounded-xl flex justify-between">
              <span className="text-slate-400">Financial Calculation Engine</span>
              <span className="font-bold text-blue-400">Decimal-Safe Server Math</span>
            </div>
          </div>
        </div>

      </div>

      {/* Security Audit Trail Log */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-bold text-slate-900 uppercase">System Audit Trail Log</h3>
          </div>
          <span className="text-xs text-slate-500 font-mono">50 Most Recent Events</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-900 text-white font-semibold uppercase">
                <th className="p-3.5">Timestamp</th>
                <th className="p-3.5">User</th>
                <th className="p-3.5">Action</th>
                <th className="p-3.5">Target</th>
                <th className="p-3.5">Details</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500">
                    Loading audit trail...
                  </td>
                </tr>
              ) : logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50">
                  <td className="p-3.5 text-slate-500 font-mono">{formatDate(log.timestamp)}</td>
                  <td className="p-3.5 font-bold text-slate-900">{log.user_name}</td>
                  <td className="p-3.5">
                    <span className="px-2 py-0.5 rounded font-mono font-bold text-[10px] bg-blue-100 text-blue-800 border border-blue-200">
                      {log.action}
                    </span>
                  </td>
                  <td className="p-3.5 font-semibold text-slate-700">{log.target}</td>
                  <td className="p-3.5 text-slate-600">{log.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}

import React from 'react';
import { Settings, ShieldCheck, User } from 'lucide-react';

export default function SettingsPage() {
  const user = { name: 'Admin Staff', username: 'admin', role: 'Administrator' };

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

    </div>
  );
}

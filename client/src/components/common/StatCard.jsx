import React from 'react';

export default function StatCard({ title, value, icon: Icon, color = 'blue', badgeText, subtitle }) {
  const colorMap = {
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
    rose: 'bg-rose-50 text-rose-700 border-rose-200',
    indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200'
  };

  const iconColorMap = {
    blue: 'bg-blue-600 text-white',
    emerald: 'bg-emerald-600 text-white',
    amber: 'bg-amber-600 text-white',
    purple: 'bg-purple-600 text-white',
    rose: 'bg-rose-600 text-white',
    indigo: 'bg-indigo-600 text-white'
  };

  return (
    <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{title}</p>
          <h3 className="text-2xl font-bold text-slate-900 mt-2 tracking-tight">{value}</h3>
        </div>
        {Icon && (
          <div className={`p-3 rounded-lg ${iconColorMap[color] || iconColorMap.blue} shadow-xs shrink-0`}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>

      {(badgeText || subtitle) && (
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
          {badgeText && (
            <span className={`px-2 py-0.5 rounded-full font-medium border ${colorMap[color] || colorMap.blue}`}>
              {badgeText}
            </span>
          )}
          {subtitle && (
            <span className="text-slate-500 ml-auto">{subtitle}</span>
          )}
        </div>
      )}
    </div>
  );
}

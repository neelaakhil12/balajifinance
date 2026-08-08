import React from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export default function Toast({ type = 'success', message, onClose }) {
  if (!message) return null;

  const isSuccess = type === 'success';
  const isError = type === 'error';

  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-xl border text-sm font-medium transition-all duration-300 transform translate-y-0 ${
      isSuccess
        ? 'bg-emerald-900/90 border-emerald-700 text-emerald-100 shadow-emerald-950/20'
        : isError
        ? 'bg-rose-900/90 border-rose-700 text-rose-100 shadow-rose-950/20'
        : 'bg-slate-900/90 border-slate-700 text-slate-100'
    }`}>
      {isSuccess && <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />}
      {isError && <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />}
      {!isSuccess && !isError && <Info className="w-5 h-5 text-blue-400 shrink-0" />}
      <span>{message}</span>
      {onClose && (
        <button onClick={onClose} className="ml-2 hover:opacity-70 text-slate-300">
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

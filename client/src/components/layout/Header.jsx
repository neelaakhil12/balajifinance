import React from 'react';
import { Building2, Menu, ShieldCheck } from 'lucide-react';

export default function Header({ toggleMobileMenu }) {
  return (
    <header className="sticky top-0 z-30 bg-slate-900 text-white border-b border-slate-800 shadow-md">
      <div className="px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Left: Mobile Toggle & Brand Logo */}
        <div className="flex items-center gap-3">
          <button
            onClick={toggleMobileMenu}
            className="lg:hidden p-2 rounded-md text-slate-300 hover:text-white hover:bg-slate-800 focus:outline-none"
            aria-label="Toggle Navigation Menu"
          >
            <Menu className="w-6 h-6" />
          </button>

          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg text-white shadow-md flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-white leading-tight">
                BALAJI SAVINGS &amp; FINANCE
              </h1>
              <p className="hidden sm:block text-[11px] text-slate-400 font-medium tracking-wide">
                Your Trusted Partner for Smart Savings &amp; Instant Support
              </p>
            </div>
          </div>
        </div>

        {/* Right: Staff Badge */}
        <div className="flex items-center gap-3 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700">
          <div className="w-8 h-8 rounded-full bg-blue-600/30 text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold text-xs">
            A
          </div>
          <div className="hidden md:block text-left">
            <p className="text-xs font-semibold text-white leading-tight">Admin Staff</p>
            <div className="flex items-center gap-1 text-[10px] text-emerald-400 font-medium">
              <ShieldCheck className="w-3 h-3" />
              <span>Authorized Staff</span>
            </div>
          </div>
        </div>

      </div>
    </header>
  );
}

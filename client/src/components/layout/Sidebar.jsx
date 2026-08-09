import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  UserPlus,
  Users,
  Layers,
  HelpCircle,
  Gavel,
  CreditCard,
  PieChart,
  FileSpreadsheet,
  Settings
} from 'lucide-react';

export default function Sidebar({ mobileOpen, closeMobileMenu }) {

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Add Member', path: '/add-member', icon: UserPlus },
    { name: 'Members', path: '/members', icon: Users },
    { name: 'Chit Schemes', path: '/schemes', icon: Layers },
    { name: 'How It Works', path: '/how-it-works', icon: HelpCircle },
    { name: 'Auction', path: '/auctions', icon: Gavel },
    { name: 'Monthly Payments', path: '/payments', icon: CreditCard },
    { name: 'Dividends', path: '/dividends', icon: PieChart },
    { name: 'Reports', path: '/reports', icon: FileSpreadsheet },
    { name: 'Settings', path: '/settings', icon: Settings },
  ];

  const sidebarContent = (
    <div className="flex flex-col h-full bg-slate-900 text-slate-300 w-64 border-r border-slate-800">
      
      {/* Menu Header / Branding Subtitle */}
      <div className="p-4 border-b border-slate-800/80">
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest px-2">
          Management Portal
        </span>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.name}
              to={item.path}
              onClick={closeMobileMenu}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-blue-600 text-white font-semibold shadow-md shadow-blue-900/30'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{item.name}</span>
            </NavLink>
          );
        })}
      </nav>

    </div>
  );

  return (
    <>
      {/* Desktop Sidebar (Persistent) */}
      <aside className="hidden lg:block shrink-0 sticky top-16 h-[calc(100vh-4rem)]">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer (Overlay) */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity"
            onClick={closeMobileMenu}
          />
          <div className="relative z-50 flex-1 max-w-xs w-full bg-slate-900">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}

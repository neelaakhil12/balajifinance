import React, { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';

import Header from './components/layout/Header';
import Sidebar from './components/layout/Sidebar';

import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import AddMemberPage from './pages/AddMemberPage';
import MembersPage from './pages/MembersPage';
import MemberProfilePage from './pages/MemberProfilePage';
import ChitSchemesPage from './pages/ChitSchemesPage';
import HowItWorksPage from './pages/HowItWorksPage';
import MonthlyAuctionPage from './pages/MonthlyAuctionPage';
import MonthlyPaymentsPage from './pages/MonthlyPaymentsPage';
import DividendsPage from './pages/DividendsPage';
import ReportsPage from './pages/ReportsPage';
import SettingsPage from './pages/SettingsPage';

function ProtectedLayout() {
  const { isAuthenticated, loading } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-semibold text-slate-300">Authenticating Balaji Management System...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <Header toggleMobileMenu={() => setMobileOpen(!mobileOpen)} />

      <div className="flex flex-1">
        <Sidebar mobileOpen={mobileOpen} closeMobileMenu={() => setMobileOpen(false)} />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full overflow-x-hidden">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/add-member" element={<AddMemberPage />} />
            <Route path="/members" element={<MembersPage />} />
            <Route path="/members/:id" element={<MemberProfilePage />} />
            <Route path="/schemes" element={<ChitSchemesPage />} />
            <Route path="/how-it-works" element={<HowItWorksPage />} />
            <Route path="/auctions" element={<MonthlyAuctionPage />} />
            <Route path="/payments" element={<MonthlyPaymentsPage />} />
            <Route path="/dividends" element={<DividendsPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/*" element={<ProtectedLayout />} />
    </Routes>
  );
}

import React, { useState } from 'react';
import { useAuth } from './context/AuthContext.jsx';
import Navbar from './components/Navbar.jsx';
import Sidebar from './components/Sidebar.jsx';
import PinLockModal from './components/PinLockModal.jsx';
import InactivityWarningModal from './components/InactivityWarningModal.jsx';

import LandingPage from './pages/LandingPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import FileUploadPage from './pages/FileUploadPage.jsx';
import EncryptionPage from './pages/EncryptionPage.jsx';
import SecureVaultPage from './pages/SecureVaultPage.jsx';
import FileDecryptionPage from './pages/FileDecryptionPage.jsx';
import ActivityHistoryPage from './pages/ActivityHistoryPage.jsx';
import SecuritySettingsPage from './pages/SecuritySettingsPage.jsx';
import UserProfilePage from './pages/UserProfilePage.jsx';

export default function App() {
  const { isAuthenticated, isLoading, isPinLocked } = useAuth();

  // Navigation state
  const [currentView, setCurrentView] = useState('dashboard');
  const [unauthView, setUnauthView] = useState('landing'); // 'landing' | 'login' | 'register'
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [quickDecryptFileId, setQuickDecryptFileId] = useState(null);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-vault-950 flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 border-4 border-cyan-500/20 border-t-cyan-400 rounded-full animate-spin" />
        <p className="text-sm font-semibold text-slate-300 mt-4 tracking-wide">
          Initializing SecureVault...
        </p>
      </div>
    );
  }

  // Unauthenticated Flow
  if (!isAuthenticated) {
    if (unauthView === 'login') {
      return (
        <LoginPage
          onSwitchToRegister={() => setUnauthView('register')}
          onLoggedIn={() => setCurrentView('dashboard')}
        />
      );
    }
    if (unauthView === 'register') {
      return (
        <RegisterPage
          onSwitchToLogin={() => setUnauthView('login')}
          onRegistered={() => setCurrentView('dashboard')}
        />
      );
    }
    return (
      <LandingPage
        onGetStarted={() => setUnauthView('register')}
        onLogin={() => setUnauthView('login')}
      />
    );
  }

  // Authenticated Dashboard & Vault Layout
  return (
    <div className="min-h-screen bg-vault-950 text-slate-100 flex flex-col">
      {/* Top Navbar */}
      <Navbar
        onToggleSidebar={() => setIsSidebarOpen(prev => !prev)}
        isSidebarOpen={isSidebarOpen}
      />

      <div className="flex-1 flex">
        {/* Navigation Sidebar */}
        <Sidebar
          currentView={currentView}
          onSelectView={(v) => {
            setCurrentView(v);
            setIsSidebarOpen(false);
          }}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />

        {/* Main Content Area */}
        <main className="flex-1 md:pl-64 flex flex-col min-w-0">
          <div className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
            {currentView === 'dashboard' && (
              <DashboardPage
                onNavigate={(v) => setCurrentView(v)}
                onQuickDecrypt={(fileId) => {
                  setQuickDecryptFileId(fileId);
                  setCurrentView('vault');
                }}
              />
            )}

            {currentView === 'upload' && (
              <FileUploadPage
                onUploadSuccess={() => setCurrentView('vault')}
              />
            )}

            {currentView === 'encrypt' && (
              <EncryptionPage />
            )}

            {currentView === 'vault' && (
              <SecureVaultPage
                initialFileToDecryptId={quickDecryptFileId}
                onClearDecryptTarget={() => setQuickDecryptFileId(null)}
              />
            )}

            {currentView === 'decrypt' && (
              <FileDecryptionPage
                initialVaultFileId={quickDecryptFileId}
              />
            )}

            {currentView === 'activity' && (
              <ActivityHistoryPage />
            )}

            {currentView === 'security' && (
              <SecuritySettingsPage />
            )}

            {currentView === 'profile' && (
              <UserProfilePage
                onNavigate={(v) => setCurrentView(v)}
              />
            )}
          </div>
        </main>
      </div>

      {/* Global Security PIN Lock Screen Overlay */}
      {isPinLocked && <PinLockModal />}

      {/* Global Inactivity Warning Countdown Modal */}
      <InactivityWarningModal />
    </div>
  );
}

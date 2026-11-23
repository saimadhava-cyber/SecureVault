import React from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { Shield, Lock, Unlock, LogOut, User, Menu, X, ShieldCheck } from 'lucide-react';

export default function Navbar({ onToggleSidebar, isSidebarOpen }) {
  const { user, logout, lockWithPin } = useAuth();

  return (
    <header className="sticky top-0 z-30 w-full bg-vault-950/80 border-b border-vault-800/80 backdrop-blur-md">
      <div className="px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Left Section: Brand & Sidebar Toggle */}
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleSidebar}
            className="md:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-vault-850 transition-colors"
            aria-label="Toggle Navigation"
          >
            {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-500 p-0.5 shadow-lg shadow-cyan-500/20 flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-bold text-base tracking-tight text-white">SecureVault</span>
                <span className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wider rounded bg-blue-950 border border-blue-500/30 text-cyan-400">
                  AES-256-GCM
                </span>
              </div>
              <span className="text-[10px] text-slate-400 tracking-wide font-medium hidden xs:block">
                Zero-Knowledge Cryptography
              </span>
            </div>
          </div>
        </div>

        {/* Right Section: Status Pill & User Controls */}
        <div className="flex items-center gap-3 sm:gap-4">
          {/* Encryption Status indicator */}
          <div className="hidden lg:flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 text-xs font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Client Crypto Active</span>
          </div>

          {/* Quick Lock Button (if user has configured a PIN) */}
          {user?.pinEnabled && (
            <button
              onClick={lockWithPin}
              title="Lock Vault Screen with PIN"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-vault-850 hover:bg-vault-800 text-slate-300 hover:text-cyan-400 border border-vault-700/60 text-xs font-medium transition-colors"
            >
              <Lock className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Lock Screen</span>
            </button>
          )}

          {/* User Profile Info */}
          {user && (
            <div className="flex items-center gap-3 pl-2 sm:pl-3 border-l border-vault-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center text-xs font-bold text-white shadow-md">
                  {user.fullName ? user.fullName.charAt(0).toUpperCase() : 'U'}
                </div>
                <div className="hidden sm:flex flex-col text-left">
                  <span className="text-xs font-semibold text-slate-200 leading-tight">
                    {user.fullName || 'User'}
                  </span>
                  <span className="text-[10px] text-slate-400 truncate max-w-[120px]">
                    {user.email}
                  </span>
                </div>
              </div>

              {/* Logout Button */}
              <button
                onClick={() => logout(false)}
                title="Sign Out"
                className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

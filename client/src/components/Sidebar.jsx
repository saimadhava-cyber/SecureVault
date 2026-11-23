import React from 'react';
import {
  LayoutDashboard,
  Upload,
  Lock,
  FolderLock,
  Unlock,
  History,
  ShieldAlert,
  User,
  KeyRound,
  FileCheck2
} from 'lucide-react';

export default function Sidebar({ currentView, onSelectView, isOpen, onClose }) {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'upload', label: 'Upload & Encrypt', icon: Upload },
    { id: 'encrypt', label: 'Encryption Studio', icon: Lock },
    { id: 'vault', label: 'Secure Vault', icon: FolderLock },
    { id: 'decrypt', label: 'Decrypt Files', icon: Unlock },
    { id: 'activity', label: 'Activity History', icon: History },
    { id: 'security', label: 'Security Settings', icon: ShieldAlert },
    { id: 'profile', label: 'User Profile', icon: User },
  ];

  const handleNav = (id) => {
    onSelectView(id);
    if (onClose) onClose();
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 md:hidden animate-in fade-in duration-200"
        />
      )}

      {/* Main Sidebar (Desktop fixed + Mobile offcanvas) */}
      <aside
        className={`fixed top-16 bottom-0 left-0 z-40 w-64 bg-vault-950/95 border-r border-vault-850 flex flex-col justify-between transition-transform duration-300 md:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-4 space-y-6 overflow-y-auto">
          {/* Navigation Items */}
          <nav className="space-y-1.5">
            <div className="px-3 pb-2 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
              Main Menu
            </div>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNav(item.id)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-blue-600/30 to-cyan-600/20 text-cyan-300 border border-cyan-500/30 shadow-lg shadow-cyan-950/50'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-vault-850/70 border border-transparent'
                  }`}
                >
                  <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Security & Cryptography Spec Card */}
        <div className="p-4 m-3 rounded-xl bg-vault-900/80 border border-vault-800 text-xs text-slate-400 space-y-2">
          <div className="flex items-center gap-2 text-cyan-400 font-semibold">
            <KeyRound className="w-3.5 h-3.5" />
            <span>Cryptographic Spec</span>
          </div>
          <div className="space-y-1 font-mono text-[11px] text-slate-300">
            <div className="flex justify-between">
              <span className="text-slate-500">Cipher:</span>
              <span className="text-cyan-300">AES-256-GCM</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Key Derivation:</span>
              <span className="text-slate-200">PBKDF2-SHA256</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Iterations:</span>
              <span className="text-emerald-400">100,000</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">IV / Salt:</span>
              <span className="text-slate-200">96-bit / 128-bit</span>
            </div>
          </div>
          <div className="pt-1 text-[10px] text-slate-500 flex items-center gap-1 border-t border-vault-800">
            <FileCheck2 className="w-3 h-3 text-emerald-400" />
            <span>Zero-Knowledge Server</span>
          </div>
        </div>
      </aside>
    </>
  );
}

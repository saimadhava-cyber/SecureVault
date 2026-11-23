import React from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { AlertTriangle, Clock } from 'lucide-react';

export default function InactivityWarningModal() {
  const { showInactivityWarning, inactivityCountdown, dismissInactivityWarning } = useAuth();

  if (!showInactivityWarning) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md p-6 rounded-2xl bg-vault-900 border border-amber-500/50 shadow-2xl shadow-amber-950/40 text-center space-y-5">
        <div className="w-14 h-14 mx-auto rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
          <AlertTriangle className="w-7 h-7 animate-bounce" />
        </div>

        <div>
          <h3 className="text-lg font-bold text-white">Inactivity Session Warning</h3>
          <p className="text-sm text-slate-300 mt-2">
            For your security, your session will automatically lock in:
          </p>
          <div className="flex items-center justify-center gap-2 mt-3 font-mono text-3xl font-extrabold text-amber-400">
            <Clock className="w-6 h-6 animate-pulse" />
            <span>{inactivityCountdown}s</span>
          </div>
        </div>

        <button
          onClick={dismissInactivityWarning}
          className="w-full vault-btn-primary"
        >
          Keep Session Active
        </button>
      </div>
    </div>
  );
}

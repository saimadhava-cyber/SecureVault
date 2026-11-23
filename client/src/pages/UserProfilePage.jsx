import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { apiRequest } from '../utils/api.js';
import { formatBytes, formatDate } from '../utils/formatters.js';
import {
  User,
  Shield,
  ShieldCheck,
  AlertCircle,
  HardDrive,
  Key,
  Lock,
  Fingerprint,
  Clock,
  ArrowRight
} from 'lucide-react';

export default function UserProfilePage({ onNavigate }) {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    apiRequest('/files/stats')
      .then(res => setStats(res.stats))
      .catch(() => {});
  }, []);

  // Compute security posture score
  let score = 50; // Base score for account created
  const checks = [
    { label: 'Master Password Active', met: true, weight: 20 },
    { label: 'Application PIN Lock Enabled', met: Boolean(user?.pinEnabled), weight: 15 },
    { label: 'Biometric Passkey Enrolled', met: Boolean(user?.biometricEnabled), weight: 15 },
    { label: 'Auto Session Timeout ≤ 15 min', met: (user?.sessionTimeoutMinutes || 15) <= 15, weight: 10 }
  ];

  let postureScore = 40;
  checks.forEach(c => {
    if (c.met) postureScore += c.weight;
  });

  const totalEncryptedBytes = stats?.totalEncryptedSizeBytes || 0;
  const maxQuota = 100 * 1024 * 1024; // 100MB

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-300">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
          <User className="w-6 h-6 text-cyan-400" />
          <span>User Profile & Security Posture</span>
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Identity telemetry, cryptographic assurance rating, and account storage quota.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: User Card */}
        <div className="vault-card p-6 text-center space-y-4">
          <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center text-3xl font-extrabold text-white shadow-xl shadow-cyan-900/50">
            {user?.fullName ? user.fullName.charAt(0).toUpperCase() : 'U'}
          </div>

          <div>
            <h2 className="text-lg font-bold text-white">{user?.fullName || 'SecureVault User'}</h2>
            <p className="text-xs text-slate-400 font-mono mt-0.5">{user?.email}</p>
          </div>

          <div className="pt-3 border-t border-vault-800 text-xs text-slate-400 space-y-2 text-left font-mono">
            <div className="flex justify-between">
              <span className="text-slate-500">Member Since:</span>
              <span className="text-slate-300">{formatDate(user?.createdAt)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Account Type:</span>
              <span className="text-cyan-400">Personal Vault</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Key Derivation:</span>
              <span className="text-slate-300">PBKDF2-SHA-256</span>
            </div>
          </div>
        </div>

        {/* Middle & Right Column: Security Score & Storage Quota */}
        <div className="md:col-span-2 space-y-6">
          {/* Security Posture Rating Card */}
          <div className="vault-card p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-vault-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Security Assurance Rating</span>
              </h3>
              <span className={`px-2.5 py-1 rounded-full text-xs font-mono font-bold ${postureScore >= 80 ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/40' : 'bg-amber-950 text-amber-400 border border-amber-500/40'}`}>
                {postureScore} / 100 {postureScore >= 80 ? 'EXCELLENT' : 'GOOD'}
              </span>
            </div>

            {/* Posture Bar */}
            <div className="w-full h-2.5 bg-vault-950 rounded-full overflow-hidden border border-vault-800">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  postureScore >= 80
                    ? 'bg-gradient-to-r from-cyan-500 to-emerald-400'
                    : 'bg-gradient-to-r from-amber-500 to-cyan-500'
                }`}
                style={{ width: `${postureScore}%` }}
              />
            </div>

            {/* Checklist */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 text-xs">
              {checks.map((c, i) => (
                <div
                  key={i}
                  className={`p-2.5 rounded-lg border flex items-center gap-2 ${
                    c.met
                      ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
                      : 'bg-vault-950 border-vault-800 text-slate-400'
                  }`}
                >
                  {c.met ? (
                    <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                  )}
                  <span>{c.label}</span>
                </div>
              ))}
            </div>

            {postureScore < 100 && (
              <div className="pt-2">
                <button
                  onClick={() => onNavigate('security')}
                  className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-semibold"
                >
                  <span>Improve Security Score in Settings</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Storage Allowance */}
          <div className="vault-card p-6 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-cyan-400" />
                <span>Vault Storage Space</span>
              </h3>
              <span className="text-xs font-mono text-slate-400">
                {formatBytes(totalEncryptedBytes)} / {formatBytes(maxQuota)}
              </span>
            </div>

            <div className="w-full h-2 bg-vault-950 rounded-full overflow-hidden border border-vault-800">
              <div
                className="h-full bg-gradient-to-r from-blue-600 to-cyan-400 rounded-full"
                style={{ width: `${Math.min(100, Math.round((totalEncryptedBytes / maxQuota) * 100))}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-500">
              Encrypted files are stored in private isolated directories with zero public web URLs.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

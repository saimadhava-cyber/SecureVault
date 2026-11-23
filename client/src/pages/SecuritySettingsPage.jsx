import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useNotification } from '../context/NotificationContext.jsx';
import { apiRequest } from '../utils/api.js';
import { webauthnClient } from '../utils/webauthnClient.js';
import PasswordStrengthMeter from '../components/PasswordStrengthMeter.jsx';
import { formatDate } from '../utils/formatters.js';
import {
  ShieldAlert,
  Key,
  Lock,
  Clock,
  Fingerprint,
  Smartphone,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Info,
  Laptop,
  Check,
  ShieldCheck
} from 'lucide-react';

export default function SecuritySettingsPage() {
  const { user, updateUserProfile, logout } = useAuth();
  const notify = useNotification();

  // Change Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // PIN lock state
  const [pinEnabled, setPinEnabled] = useState(Boolean(user?.pinEnabled));
  const [newPin, setNewPin] = useState('');
  const [isUpdatingPin, setIsUpdatingPin] = useState(false);

  // Session timeout state
  const [sessionTimeout, setSessionTimeout] = useState(user?.sessionTimeoutMinutes || 15);
  const [isUpdatingTimeout, setIsUpdatingTimeout] = useState(false);

  // Biometrics state
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnrolled, setBiometricEnrolled] = useState(Boolean(user?.biometricEnabled));
  const [isRegisteringPasskey, setIsRegisteringPasskey] = useState(false);

  // Active sessions state
  const [sessions, setSessions] = useState([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);

  // Delete account state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  useEffect(() => {
    webauthnClient.isPlatformAuthenticatorAvailable().then(setBiometricAvailable);
    loadSessions();
  }, []);

  const loadSessions = async () => {
    setIsLoadingSessions(true);
    try {
      const res = await apiRequest('/user/sessions');
      setSessions(res.sessions || []);
    } catch (e) {
      console.warn('Failed to load sessions:', e);
    } finally {
      setIsLoadingSessions(false);
    }
  };

  // 1. Change password
  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      notify.error('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      notify.error('New passwords do not match.');
      return;
    }

    setIsChangingPassword(true);
    try {
      await apiRequest('/user/password', {
        method: 'PUT',
        body: JSON.stringify({ currentPassword, newPassword })
      });
      notify.success('Master account password updated successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (err) {
      notify.error(err.message || 'Failed to update password.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  // 2. Update PIN
  const handleTogglePin = async (enable) => {
    if (enable) {
      if (!/^\d{4,8}$/.test(newPin)) {
        notify.error('Please enter a 4 to 8 digit numeric PIN.');
        return;
      }
    }

    setIsUpdatingPin(true);
    try {
      const res = await apiRequest('/user/pin', {
        method: 'PUT',
        body: JSON.stringify({ enabled: enable, pin: enable ? newPin : undefined })
      });
      setPinEnabled(res.pinEnabled);
      updateUserProfile({ pinEnabled: res.pinEnabled });
      notify.success(res.message);
      setNewPin('');
    } catch (err) {
      notify.error(err.message || 'Failed to update PIN.');
    } finally {
      setIsUpdatingPin(false);
    }
  };

  // 3. Update Session Timeout
  const handleSaveTimeout = async () => {
    setIsUpdatingTimeout(true);
    try {
      await apiRequest('/user/settings', {
        method: 'PUT',
        body: JSON.stringify({ sessionTimeoutMinutes: sessionTimeout })
      });
      updateUserProfile({ sessionTimeoutMinutes: sessionTimeout });
      notify.success(`Auto session timeout set to ${sessionTimeout} minutes.`);
    } catch (err) {
      notify.error(err.message || 'Failed to update timeout.');
    } finally {
      setIsUpdatingTimeout(false);
    }
  };

  // 4. Enroll WebAuthn Biometric Passkey (Temporarily Unavailable)
  const handleRegisterBiometric = async () => {
    notify.error('Biometric passkey registration is temporarily unavailable pending server-side WebAuthn verification.');
  };

  // 5. Revoke a session
  const handleRevokeSession = async (sessionId) => {
    try {
      await apiRequest(`/user/sessions/${sessionId}`, { method: 'DELETE' });
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      notify.success('Session revoked.');
    } catch (err) {
      notify.error('Failed to revoke session: ' + err.message);
    }
  };

  // 6. Delete entire account
  const handleDeleteAccount = async (e) => {
    e.preventDefault();
    if (!deletePassword) return;

    setIsDeletingAccount(true);
    try {
      await apiRequest('/user/account', {
        method: 'DELETE',
        body: JSON.stringify({ confirmPassword: deletePassword })
      });
      notify.success('Account and encrypted vault permanently wiped.');
      logout(false);
    } catch (err) {
      notify.error(err.message || 'Account deletion failed.');
      setIsDeletingAccount(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-300">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
          <ShieldAlert className="w-6 h-6 text-cyan-400" />
          <span>Security & Privacy Settings</span>
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Configure authentication safeguards, session timeouts, hardware biometric passkeys, and account privacy.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Module 7: Master Account Password */}
        <div className="vault-card p-6 space-y-4">
          <div className="flex items-center gap-3 border-b border-vault-800 pb-3">
            <div className="p-2 rounded-xl bg-blue-600/20 text-cyan-400">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Change Account Password</h3>
              <p className="text-xs text-slate-400">Update your account authentication password</p>
            </div>
          </div>

          <form onSubmit={handleChangePassword} className="space-y-4 max-w-lg">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Current Password
              </label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="vault-input"
                placeholder="••••••••••••"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                New Password
              </label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="vault-input"
                placeholder="Minimum 8 characters"
              />
              <PasswordStrengthMeter password={newPassword} />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Confirm New Password
              </label>
              <input
                type="password"
                required
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                className="vault-input"
                placeholder="••••••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={isChangingPassword || !currentPassword || !newPassword}
              className="vault-btn-primary"
            >
              {isChangingPassword ? 'Updating Password...' : 'Save New Password'}
            </button>
          </form>
        </div>

        {/* PIN-Based Application Lock */}
        <div className="vault-card p-6 space-y-4">
          <div className="flex items-center gap-3 border-b border-vault-800 pb-3">
            <div className="p-2 rounded-xl bg-cyan-600/20 text-cyan-400">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Application PIN Lock</h3>
              <p className="text-xs text-slate-400">
                Quick 4 to 8 digit numeric passcode to lock the vault screen during active sessions
              </p>
            </div>
          </div>

          <div className="max-w-lg space-y-4">
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-vault-950 border border-vault-800">
              <div>
                <p className="text-xs font-semibold text-white">PIN Screen Lock Status</p>
                <p className="text-[11px] text-slate-400">
                  {pinEnabled ? 'Enabled. App locks upon inactivity or manual lock.' : 'Disabled'}
                </p>
              </div>
              <span className={`px-2 py-0.5 rounded text-xs font-bold ${pinEnabled ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/30' : 'bg-vault-800 text-slate-400'}`}>
                {pinEnabled ? 'ACTIVE' : 'OFF'}
              </span>
            </div>

            {!pinEnabled ? (
              <div className="space-y-3">
                <label className="block text-xs font-semibold text-slate-300">
                  Set 4 to 8 Digit PIN
                </label>
                <div className="flex gap-2">
                  <input
                    type="password"
                    maxLength={8}
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                    placeholder="e.g. 123456"
                    className="vault-input font-mono max-w-[200px]"
                  />
                  <button
                    onClick={() => handleTogglePin(true)}
                    disabled={isUpdatingPin || newPin.length < 4}
                    className="vault-btn-primary"
                  >
                    Enable PIN Lock
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <button
                  onClick={() => handleTogglePin(false)}
                  disabled={isUpdatingPin}
                  className="vault-btn-danger text-xs"
                >
                  Disable PIN Lock
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Automatic Session Timeout */}
        <div className="vault-card p-6 space-y-4">
          <div className="flex items-center gap-3 border-b border-vault-800 pb-3">
            <div className="p-2 rounded-xl bg-purple-600/20 text-purple-400">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Automatic Inactivity Timeout</h3>
              <p className="text-xs text-slate-400">
                Automatically locks or signs out your session when idle
              </p>
            </div>
          </div>

          <div className="max-w-lg space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {[5, 15, 30, 60].map((mins) => (
                <button
                  key={mins}
                  onClick={() => setSessionTimeout(mins)}
                  className={`p-3 rounded-xl border text-center transition-all ${
                    sessionTimeout === mins
                      ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 font-bold shadow-md shadow-cyan-950'
                      : 'bg-vault-950 border-vault-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <div className="text-base">{mins}</div>
                  <div className="text-[10px] uppercase tracking-wider">Minutes</div>
                </button>
              ))}
            </div>

            <button
              onClick={handleSaveTimeout}
              disabled={isUpdatingTimeout}
              className="vault-btn-secondary text-xs"
            >
              {isUpdatingTimeout ? 'Saving...' : 'Apply Timeout Policy'}
            </button>
          </div>
        </div>

        {/* Biometric WebAuthn Passkeys */}
        <div className="vault-card p-6 space-y-4">
          <div className="flex items-center gap-3 border-b border-vault-800 pb-3">
            <div className="p-2 rounded-xl bg-amber-600/20 text-amber-400">
              <Fingerprint className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Biometric Passkey Authentication</h3>
              <p className="text-xs text-slate-400">
                Hardware-backed passkeys via WebAuthn (Touch ID, Windows Hello, Face ID)
              </p>
            </div>
          </div>

          <div className="max-w-lg space-y-3">
            <div className="p-3.5 rounded-xl bg-vault-950 border border-vault-800 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-white">Device Capability</p>
                <p className="text-[11px] text-slate-400">
                  {biometricAvailable
                    ? 'Platform biometric hardware detected on this device.'
                    : 'Platform authenticator not detected or not supported on this browser.'}
                </p>
              </div>
              <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${biometricAvailable ? 'bg-amber-950 text-amber-400 border border-amber-500/30' : 'bg-vault-800 text-slate-500'}`}>
                {biometricAvailable ? 'TEMPORARILY UNAVAILABLE' : 'UNSUPPORTED'}
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-amber-950/20 border border-amber-500/20 text-xs text-amber-200/90 leading-relaxed">
              Biometric passkey registration and login are temporarily disabled pending server-side WebAuthn verification.
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-slate-400">
                Status: Temporarily Unavailable
              </span>

              <button
                disabled
                className="vault-btn-secondary text-xs opacity-50 cursor-not-allowed"
                title="Biometric registration is temporarily unavailable"
              >
                <Fingerprint className="w-3.5 h-3.5" />
                <span>Registration Unavailable</span>
              </button>
            </div>
          </div>
        </div>

        {/* Active Sessions Management */}
        <div className="vault-card p-6 space-y-4">
          <div className="flex items-center gap-3 border-b border-vault-800 pb-3">
            <div className="p-2 rounded-xl bg-vault-800 text-cyan-400">
              <Laptop className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Active Sessions</h3>
              <p className="text-xs text-slate-400">Manage signed-in browsers and devices</p>
            </div>
          </div>

          {isLoadingSessions ? (
            <p className="text-xs text-slate-400">Loading active sessions...</p>
          ) : (
            <div className="space-y-2">
              {sessions.map((s) => (
                <div
                  key={s.id}
                  className="p-3 rounded-xl bg-vault-950 border border-vault-800 flex items-center justify-between text-xs"
                >
                  <div>
                    <p className="font-semibold text-white">{s.device_info}</p>
                    <p className="text-[10px] text-slate-400 font-mono">
                      IP: {s.ip_address} • Last Active: {formatDate(s.last_active_at)}
                    </p>
                  </div>
                  <button
                    onClick={() => handleRevokeSession(s.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-vault-850 transition-colors"
                    title="Revoke session"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Danger Zone: Delete Account */}
        <div className="vault-card p-6 border-red-500/30 space-y-4 bg-red-950/10">
          <div className="flex items-center gap-3 border-b border-red-500/20 pb-3">
            <div className="p-2 rounded-xl bg-red-600/20 text-red-400">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-red-400">Danger Zone: Delete Vault Account</h3>
              <p className="text-xs text-slate-400">
                Permanently erase your account and shred all stored encrypted files from disk
              </p>
            </div>
          </div>

          {!showDeleteModal ? (
            <button
              onClick={() => setShowDeleteModal(true)}
              className="vault-btn-danger text-xs"
            >
              Delete My Account & Vault
            </button>
          ) : (
            <form onSubmit={handleDeleteAccount} className="max-w-md space-y-3">
              <p className="text-xs text-red-300">
                Enter your password to confirm permanent deletion of all encrypted files and credentials.
              </p>
              <input
                type="password"
                required
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                placeholder="Confirm password"
                className="vault-input border-red-500/40"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(false)}
                  className="vault-btn-secondary text-xs flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isDeletingAccount || !deletePassword}
                  className="vault-btn-danger text-xs flex-1"
                >
                  {isDeletingAccount ? 'Erasing...' : 'Confirm Permanent Deletion'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

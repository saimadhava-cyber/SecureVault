import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useNotification } from '../context/NotificationContext.jsx';
import { apiRequest } from '../utils/api.js';
import { webauthnClient } from '../utils/webauthnClient.js';
import { Shield, Lock, Mail, Fingerprint, ArrowRight, KeyRound, HelpCircle } from 'lucide-react';

export default function LoginPage({ onSwitchToRegister, onLoggedIn }) {
  const { login } = useAuth();
  const notify = useNotification();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [biometricAvailable, setBiometricAvailable] = useState(false);

  // Forgot password modal state
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [forgotStep, setForgotStep] = useState(1); // 1: request code, 2: enter code & new pass
  const [forgotMsg, setForgotMsg] = useState('');

  useEffect(() => {
    webauthnClient.isPlatformAuthenticatorAvailable().then(setBiometricAvailable);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password) {
      setError('Email and password are required.');
      return;
    }

    setIsSubmitting(true);
    try {
      const data = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), password })
      });

      notify.success('Authentication successful. Welcome back!');
      login(data.user, data.token);
      if (onLoggedIn) onLoggedIn();
    } catch (err) {
      setError(err.message || 'Invalid credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Biometric / Passkey Login (Temporarily Unavailable)
  const handleBiometricLogin = async () => {
    setError('Biometric authentication is temporarily unavailable pending server-side WebAuthn verification.');
  };

  // Forgot password step 1: generate code
  const handleRequestRecovery = async (e) => {
    e.preventDefault();
    if (!forgotEmail) return;
    try {
      const res = await apiRequest('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: forgotEmail })
      });
      if (res.demoRecoveryCode) {
        setRecoveryCode(res.demoRecoveryCode);
        setForgotMsg(`Recovery code generated: ${res.demoRecoveryCode}`);
      } else {
        setForgotMsg('Instructions sent.');
      }
      setForgotStep(2);
    } catch (err) {
      setError(err.message);
    }
  };

  // Forgot password step 2: reset
  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!recoveryCode || !newPassword) return;
    try {
      await apiRequest('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({
          email: forgotEmail,
          recoveryCode,
          newPassword
        })
      });
      notify.success('Password reset successfully! You can now log in.');
      setShowForgotModal(false);
      setForgotStep(1);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-vault-950 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center space-y-3">
        <div className="w-12 h-12 mx-auto rounded-2xl bg-gradient-to-tr from-blue-600 to-cyan-500 p-0.5 shadow-xl shadow-cyan-500/20 flex items-center justify-center">
          <Shield className="w-6 h-6 text-white" />
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          Unlock Your Vault
        </h2>
        <p className="text-xs text-slate-400">
          Sign in to access your zero-knowledge encrypted files.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="vault-card p-6 sm:p-8 space-y-5">
          {error && (
            <div className="p-3.5 rounded-lg bg-red-950/80 border border-red-500/40 text-red-200 text-xs font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="alice@example.com"
                  className="vault-input pl-10"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-slate-300">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setForgotEmail(email);
                    setShowForgotModal(true);
                  }}
                  className="text-[11px] text-cyan-400 hover:text-cyan-300 transition-colors"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="vault-input pl-10"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full vault-btn-primary mt-2"
            >
              <span>{isSubmitting ? 'Authenticating...' : 'Sign In to Vault'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Biometric Passkey Sign-In Option */}
          {biometricAvailable && (
            <div className="pt-2">
              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-vault-800"></div>
                <span className="flex-shrink mx-3 text-[11px] text-slate-500 uppercase tracking-wider">
                  Biometric Passkey
                </span>
                <div className="flex-grow border-t border-vault-800"></div>
              </div>

              <div className="p-3 rounded-xl bg-vault-950/70 border border-amber-500/30 text-center space-y-1">
                <div className="flex items-center justify-center gap-2 text-xs font-semibold text-amber-400">
                  <Fingerprint className="w-4 h-4" />
                  <span>Biometric Sign-In Temporarily Unavailable</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Hardware passkey authentication is temporarily disabled pending server-side WebAuthn verification. Please sign in with your email and master password.
                </p>
              </div>
            </div>
          )}

          <div className="pt-4 border-t border-vault-800 text-center">
            <p className="text-xs text-slate-400">
              Don't have a secure vault yet?{' '}
              <button
                onClick={onSwitchToRegister}
                className="text-cyan-400 hover:text-cyan-300 font-semibold transition-colors"
              >
                Create an account
              </button>
            </p>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md p-6 rounded-2xl bg-vault-900 border border-vault-700 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Password Recovery</h3>
                <p className="text-xs text-slate-400">Account access recovery information</p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-500/30 text-xs text-amber-200/90 space-y-2">
              <p className="font-semibold text-amber-400">Self-Service Recovery Temporarily Unavailable</p>
              <p className="text-slate-300 leading-relaxed">
                Self-service password recovery is temporarily disabled until verified email-based authentication is configured.
              </p>
              <p className="text-slate-400 text-[11px]">
                To restore access to your encrypted vault or reset your credentials, please contact your system administrator.
              </p>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowForgotModal(false)}
                className="w-full vault-btn-secondary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

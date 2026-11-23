import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useNotification } from '../context/NotificationContext.jsx';
import { Lock, Delete, LogOut, ShieldAlert } from 'lucide-react';

export default function PinLockModal() {
  const { unlockWithPin, logout, user } = useAuth();
  const notify = useNotification();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const handleDigit = (digit) => {
    if (pin.length < 8) {
      setPin(prev => prev + digit);
      setError('');
    }
  };

  const handleBackspace = () => {
    setPin(prev => prev.slice(0, -1));
    setError('');
  };

  const handleClear = () => {
    setPin('');
    setError('');
  };

  const submitPin = async (pinToVerify) => {
    if (!pinToVerify || pinToVerify.length < 4) {
      setError('PIN must be at least 4 digits');
      return;
    }
    setIsVerifying(true);
    setError('');
    try {
      const success = await unlockWithPin(pinToVerify);
      if (success) {
        notify.success('Vault unlocked successfully');
        setPin('');
      } else {
        setError('Incorrect PIN. Please try again.');
        setPin('');
      }
    } catch (err) {
      setError(err.message || 'Incorrect PIN.');
      setPin('');
    } finally {
      setIsVerifying(false);
    }
  };

  // Physical keyboard listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key >= '0' && e.key <= '9') {
        handleDigit(e.key);
      } else if (e.key === 'Backspace') {
        handleBackspace();
      } else if (e.key === 'Enter') {
        submitPin(pin);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pin]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-vault-950/95 backdrop-blur-xl animate-in fade-in duration-300">
      <div className="w-full max-w-sm p-6 rounded-2xl bg-vault-900 border border-vault-700/80 shadow-2xl shadow-cyan-950/80 text-center space-y-6">
        {/* Lock Icon */}
        <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-tr from-blue-600 to-cyan-500 p-0.5 shadow-xl shadow-cyan-500/20 flex items-center justify-center">
          <div className="w-full h-full bg-vault-950 rounded-2xl flex items-center justify-center">
            <Lock className="w-8 h-8 text-cyan-400 animate-pulse" />
          </div>
        </div>

        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Vault Screen Locked</h2>
          <p className="text-xs text-slate-400 mt-1">
            Session for <span className="text-slate-200 font-medium">{user?.email}</span> is locked. Enter your PIN to resume.
          </p>
        </div>

        {/* PIN Indicators */}
        <div className="flex justify-center gap-3 py-2">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className={`w-3.5 h-3.5 rounded-full border transition-all duration-200 ${
                i < pin.length
                  ? 'bg-cyan-400 border-cyan-300 shadow-md shadow-cyan-500/50 scale-110'
                  : 'bg-vault-800 border-vault-700'
              }`}
            />
          ))}
        </div>

        {error && (
          <div className="text-xs text-red-400 font-medium animate-bounce flex items-center justify-center gap-1">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Numeric Keypad */}
        <div className="grid grid-cols-3 gap-2.5 max-w-[240px] mx-auto">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <button
              key={num}
              onClick={() => handleDigit(num.toString())}
              disabled={isVerifying}
              className="h-12 rounded-xl bg-vault-850 hover:bg-vault-750 active:bg-cyan-600/30 text-white font-semibold text-lg border border-vault-700/60 shadow-sm transition-all"
            >
              {num}
            </button>
          ))}
          <button
            onClick={handleClear}
            disabled={isVerifying}
            className="h-12 rounded-xl bg-vault-850 hover:bg-vault-750 text-slate-400 hover:text-white text-xs font-semibold uppercase border border-vault-700/60 transition-all"
          >
            Clear
          </button>
          <button
            onClick={() => handleDigit('0')}
            disabled={isVerifying}
            className="h-12 rounded-xl bg-vault-850 hover:bg-vault-750 active:bg-cyan-600/30 text-white font-semibold text-lg border border-vault-700/60 shadow-sm transition-all"
          >
            0
          </button>
          <button
            onClick={handleBackspace}
            disabled={isVerifying}
            className="h-12 rounded-xl bg-vault-850 hover:bg-vault-750 text-slate-400 hover:text-red-400 flex items-center justify-center border border-vault-700/60 transition-all"
          >
            <Delete className="w-5 h-5" />
          </button>
        </div>

        {/* Submit & Forgot PIN controls */}
        <div className="space-y-3 pt-2">
          <button
            onClick={() => submitPin(pin)}
            disabled={pin.length < 4 || isVerifying}
            className="w-full vault-btn-primary"
          >
            {isVerifying ? 'Verifying PIN...' : 'Unlock Vault'}
          </button>

          <button
            onClick={() => logout(false)}
            className="w-full flex items-center justify-center gap-1.5 text-xs text-slate-400 hover:text-red-400 transition-colors py-1"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Forgot PIN? Sign out and use password</span>
          </button>
        </div>
      </div>
    </div>
  );
}

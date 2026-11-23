import React from 'react';
import { evaluatePasswordStrength } from '../utils/formatters.js';
import { Check, X } from 'lucide-react';

export default function PasswordStrengthMeter({ password }) {
  const { score, label, color, barColor } = evaluatePasswordStrength(password);

  const checks = [
    { label: 'At least 8 characters', met: (password || '').length >= 8 },
    { label: 'Upper & lowercase letters', met: /[a-z]/.test(password || '') && /[A-Z]/.test(password || '') },
    { label: 'At least one number', met: /[0-9]/.test(password || '') },
    { label: 'At least one special character', met: /[^A-Za-z0-9]/.test(password || '') },
  ];

  if (!password) return null;

  return (
    <div className="mt-2 space-y-2 text-xs">
      <div className="flex items-center justify-between">
        <span className="text-slate-400">Password Strength:</span>
        <span className={`font-semibold ${color}`}>{label}</span>
      </div>

      {/* Strength Bar */}
      <div className="w-full h-1.5 bg-vault-800 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-300 ${barColor}`}
          style={{ width: `${score}%` }}
        />
      </div>

      {/* Rules list */}
      <div className="grid grid-cols-2 gap-1 pt-1 text-slate-400">
        {checks.map((c, i) => (
          <div key={i} className="flex items-center gap-1.5">
            {c.met ? (
              <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
            ) : (
              <X className="w-3.5 h-3.5 text-slate-600 flex-shrink-0" />
            )}
            <span className={c.met ? 'text-slate-300' : 'text-slate-500'}>{c.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

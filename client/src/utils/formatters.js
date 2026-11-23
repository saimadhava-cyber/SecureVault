/**
 * Formatting and utility helpers for SecureVault
 */

export function formatBytes(bytes, decimals = 2) {
  if (bytes === 0 || !bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export function formatDate(dateString) {
  if (!dateString) return 'N/A';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return d.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (e) {
    return dateString;
  }
}

export function truncate(str, max = 24) {
  if (!str) return '';
  if (str.length <= max) return str;
  const half = Math.floor((max - 3) / 2);
  return str.substring(0, half) + '...' + str.substring(str.length - half);
}

/**
 * Generate a cryptographically strong multi-word or randomized passphrase
 */
export function generateRandomPassphrase(length = 20) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
  const array = new Uint32Array(length);
  window.crypto.getRandomValues(array);
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[array[i] % chars.length];
  }
  return result;
}

/**
 * Calculate password entropy and strength meter score (0-100)
 */
export function evaluatePasswordStrength(password) {
  if (!password) return { score: 0, label: 'Empty', color: 'text-slate-500', barColor: 'bg-slate-700' };

  let score = 0;
  if (password.length >= 8) score += 20;
  if (password.length >= 12) score += 15;
  if (password.length >= 16) score += 15;
  if (/[a-z]/.test(password)) score += 10;
  if (/[A-Z]/.test(password)) score += 10;
  if (/[0-9]/.test(password)) score += 15;
  if (/[^A-Za-z0-9]/.test(password)) score += 15;

  if (score < 40) {
    return { score, label: 'Weak', color: 'text-red-400', barColor: 'bg-red-500' };
  } else if (score < 70) {
    return { score, label: 'Moderate', color: 'text-amber-400', barColor: 'bg-amber-500' };
  } else if (score < 90) {
    return { score, label: 'Strong', color: 'text-emerald-400', barColor: 'bg-emerald-500' };
  } else {
    return { score: 100, label: 'Very Strong', color: 'text-cyan-400', barColor: 'bg-cyan-500' };
  }
}

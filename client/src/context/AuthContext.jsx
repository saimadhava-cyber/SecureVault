import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { apiRequest, setUnauthorizedHandler } from '../utils/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('vault_user');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });
  const [token, setToken] = useState(() => localStorage.getItem('vault_token'));
  const [isLoading, setIsLoading] = useState(true);
  const [isPinLocked, setIsPinLocked] = useState(() => {
    return localStorage.getItem('vault_pin_locked') === 'true';
  });

  // Inactivity tracking state
  const [showInactivityWarning, setShowInactivityWarning] = useState(false);
  const [inactivityCountdown, setInactivityCountdown] = useState(60);

  const lastActivityRef = useRef(Date.now());
  const timerRef = useRef(null);
  const countdownIntervalRef = useRef(null);

  // Set up unauthorized interceptor
  useEffect(() => {
    setUnauthorizedHandler(() => {
      logout(true, 'Your session expired. Please sign in again.');
    });
  }, []);

  // Fetch current user on mount if token exists
  useEffect(() => {
    async function verifyUser() {
      if (!token) {
        setIsLoading(false);
        return;
      }
      try {
        const data = await apiRequest('/auth/me');
        setUser(data.user);
        localStorage.setItem('vault_user', JSON.stringify(data.user));
      } catch (err) {
        console.warn('Failed to verify token on mount:', err.message);
        // Clear invalid session
        setToken(null);
        setUser(null);
        localStorage.removeItem('vault_token');
        localStorage.removeItem('vault_user');
      } finally {
        setIsLoading(false);
      }
    }
    verifyUser();
  }, [token]);

  // Login handler
  const login = useCallback((userData, jwtToken) => {
    setUser(userData);
    setToken(jwtToken);
    localStorage.setItem('vault_user', JSON.stringify(userData));
    localStorage.setItem('vault_token', jwtToken);
    setIsPinLocked(false);
    localStorage.removeItem('vault_pin_locked');
    lastActivityRef.current = Date.now();
  }, []);

  // Logout handler
  const logout = useCallback(async (isAuto = false, reason = '') => {
    try {
      if (token) {
        await apiRequest('/auth/logout', { method: 'POST' }).catch(() => {});
      }
    } catch (e) {}

    setUser(null);
    setToken(null);
    setIsPinLocked(false);
    setShowInactivityWarning(false);
    localStorage.removeItem('vault_user');
    localStorage.removeItem('vault_token');
    localStorage.removeItem('vault_pin_locked');
  }, [token]);

  // Lock application with PIN
  const lockWithPin = useCallback(() => {
    if (user?.pinEnabled) {
      setIsPinLocked(true);
      localStorage.setItem('vault_pin_locked', 'true');
      setShowInactivityWarning(false);
    }
  }, [user]);

  // Unlock application with PIN
  const unlockWithPin = useCallback(async (enteredPin) => {
    const res = await apiRequest('/user/verify-pin', {
      method: 'POST',
      body: JSON.stringify({ pin: enteredPin })
    });
    if (res.valid) {
      setIsPinLocked(false);
      localStorage.removeItem('vault_pin_locked');
      lastActivityRef.current = Date.now();
      return true;
    }
    return false;
  }, []);

  // Update user profile locally
  const updateUserProfile = useCallback((updates) => {
    setUser(prev => {
      const updated = { ...prev, ...updates };
      localStorage.setItem('vault_user', JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Register user handler
  const register = useCallback((userData, jwtToken) => {
    login(userData, jwtToken);
  }, [login]);

  // Reset user activity timestamp
  const recordActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    if (showInactivityWarning) {
      setShowInactivityWarning(false);
    }
  }, [showInactivityWarning]);

  // Inactivity tracker loop
  useEffect(() => {
    if (!user || !token || isPinLocked) return;

    const timeoutMinutes = user.sessionTimeoutMinutes || 15;
    const timeoutMs = timeoutMinutes * 60 * 1000;
    const warningMs = Math.max(0, timeoutMs - 60 * 1000); // 60 seconds before expiration

    const activityEvents = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];
    const handleEvent = () => recordActivity();

    activityEvents.forEach(e => window.addEventListener(e, handleEvent, { passive: true }));

    timerRef.current = setInterval(() => {
      const idleTime = Date.now() - lastActivityRef.current;

      // Show warning countdown if 60s remaining
      if (idleTime >= warningMs && idleTime < timeoutMs) {
        const remainingSec = Math.max(0, Math.round((timeoutMs - idleTime) / 1000));
        setShowInactivityWarning(true);
        setInactivityCountdown(remainingSec);
      } else if (idleTime >= timeoutMs) {
        // Timeout triggered!
        setShowInactivityWarning(false);
        if (user.pinEnabled) {
          // If PIN is enabled, lock with PIN
          lockWithPin();
        } else {
          // Otherwise log out
          logout(true, 'Logged out due to inactivity.');
        }
      } else {
        if (showInactivityWarning) {
          setShowInactivityWarning(false);
        }
      }
    }, 1000);

    return () => {
      activityEvents.forEach(e => window.removeEventListener(e, handleEvent));
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [user, token, isPinLocked, recordActivity, lockWithPin, logout, showInactivityWarning]);

  const value = {
    user,
    token,
    isLoading,
    isAuthenticated: Boolean(user && token),
    isPinLocked,
    showInactivityWarning,
    inactivityCountdown,
    login,
    register,
    logout,
    lockWithPin,
    unlockWithPin,
    updateUserProfile,
    recordActivity,
    dismissInactivityWarning: () => {
      recordActivity();
      setShowInactivityWarning(false);
    }
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

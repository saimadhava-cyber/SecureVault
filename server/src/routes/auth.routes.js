import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config.js';
import { dbOperations } from '../db/index.js';
import { auditLogger } from '../services/auditLogger.js';
import { authenticate } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// Helper to generate JWT token
function generateToken(userId) {
  return jwt.sign({ userId }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
}

// Helper to set cookie
function setAuthCookie(res, token) {
  res.cookie('vault_token', token, {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  });
}

// Helper to record user session
function recordSession(userId, token, req) {
  try {
    const sessionId = uuidv4();
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const deviceInfo = req.headers['user-agent'] || 'Web Browser';
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    
    // Expires in 24 hours
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    dbOperations.run(
      `INSERT INTO user_sessions (id, user_id, token_hash, device_info, ip_address, expires_at, created_at, last_active_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [sessionId, userId, tokenHash, deviceInfo, ip, expiresAt]
    );
  } catch (err) {
    console.error('Session record error:', err.message);
  }
}

// 1. User Registration
router.post('/register', authLimiter, async (req, res, next) => {
  try {
    const { email, password, fullName } = req.body;

    if (!email || !password || !fullName) {
      return res.status(400).json({ error: 'Email, password, and full name are required.' });
    }

    const trimmedEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }

    // Password strength verification
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
    }

    // Check if user already exists
    const existing = dbOperations.get('SELECT id FROM users WHERE email = ?', [trimmedEmail]);
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    // Hash password using bcrypt with 12 salt rounds
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    const userId = uuidv4();
    dbOperations.run(
      `INSERT INTO users (id, email, password_hash, full_name, session_timeout_minutes, created_at, updated_at)
       VALUES (?, ?, ?, ?, 15, datetime('now'), datetime('now'))`,
      [userId, trimmedEmail, passwordHash, fullName.trim()]
    );

    const token = generateToken(userId);
    setAuthCookie(res, token);
    recordSession(userId, token, req);

    auditLogger.log({
      userId,
      actionType: 'REGISTER_SUCCESS',
      details: { email: trimmedEmail },
      req
    });

    const user = {
      id: userId,
      email: trimmedEmail,
      fullName: fullName.trim(),
      pinEnabled: false,
      sessionTimeoutMinutes: 15,
      biometricEnabled: false
    };

    res.status(201).json({
      message: 'Account successfully registered.',
      token,
      user
    });
  } catch (err) {
    next(err);
  }
});

// 2. User Login
router.post('/login', authLimiter, async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const trimmedEmail = email.trim().toLowerCase();
    const user = dbOperations.get('SELECT * FROM users WHERE email = ?', [trimmedEmail]);

    if (!user) {
      // Avoid timing attacks by running dummy compare
      await bcrypt.compare(password, '$2a$12$e80Y2qAekz0P7kQ41GfFDuU14kI9.yC7x5q5f5q5f5q5f5q5f5q5');
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      auditLogger.log({
        userId: user.id,
        actionType: 'LOGIN_FAILED',
        details: { reason: 'Incorrect password' },
        req
      });
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = generateToken(user.id);
    setAuthCookie(res, token);
    recordSession(user.id, token, req);

    auditLogger.log({
      userId: user.id,
      actionType: 'LOGIN_SUCCESS',
      details: { email: trimmedEmail },
      req
    });

    const userProfile = {
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      pinEnabled: Boolean(user.pin_enabled),
      sessionTimeoutMinutes: user.session_timeout_minutes || 15,
      biometricEnabled: Boolean(user.biometric_enabled),
      createdAt: user.created_at
    };

    res.json({
      message: 'Authentication successful.',
      token,
      user: userProfile
    });
  } catch (err) {
    next(err);
  }
});

// 3. User Logout
router.post('/logout', authenticate, (req, res) => {
  try {
    res.clearCookie('vault_token', {
      httpOnly: true,
      secure: config.isProduction,
      sameSite: 'lax'
    });

    // Invalidate session if token provided
    if (req.token) {
      const tokenHash = crypto.createHash('sha256').update(req.token).digest('hex');
      dbOperations.run('DELETE FROM user_sessions WHERE token_hash = ?', [tokenHash]);
    }

    auditLogger.log({
      userId: req.user.id,
      actionType: 'LOGOUT',
      details: {},
      req
    });

    res.json({ message: 'Logged out successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to logout: ' + err.message });
  }
});

// 4. Get Current Authenticated User (Profile & Session)
router.get('/me', authenticate, (req, res) => {
  const user = dbOperations.get(
    `SELECT id, email, full_name, pin_enabled, session_timeout_minutes, biometric_enabled, created_at
     FROM users WHERE id = ?`,
    [req.user.id]
  );

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.json({
    user: {
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      pinEnabled: Boolean(user.pin_enabled),
      sessionTimeoutMinutes: user.session_timeout_minutes || 15,
      biometricEnabled: Boolean(user.biometric_enabled),
      createdAt: user.created_at
    }
  });
});

// 5. Password Reset Request (Temporarily Disabled for Security)
router.post('/forgot-password', authLimiter, (req, res) => {
  return res.status(501).json({
    error: 'Password recovery is temporarily unavailable. Please contact the administrator.',
    code: 'RECOVERY_UNAVAILABLE'
  });
});

// 6. Reset Password with Recovery Code (Temporarily Disabled for Security)
router.post('/reset-password', authLimiter, (req, res) => {
  return res.status(501).json({
    error: 'Password reset is temporarily unavailable. Please contact the administrator.',
    code: 'RECOVERY_UNAVAILABLE'
  });
});

// 7. WebAuthn Biometric Registration Challenge (Temporarily Disabled)
router.post('/biometric/register-challenge', authenticate, (req, res) => {
  return res.status(501).json({
    error: 'Biometric authentication is temporarily unavailable pending server-side WebAuthn verification.',
    code: 'BIOMETRIC_UNAVAILABLE'
  });
});

// 8. WebAuthn Biometric Registration Verification (Temporarily Disabled)
router.post('/biometric/register-verify', authenticate, (req, res) => {
  return res.status(501).json({
    error: 'Biometric registration is temporarily unavailable pending server-side WebAuthn verification.',
    code: 'BIOMETRIC_UNAVAILABLE'
  });
});

// 9. WebAuthn Biometric Login Challenge (Temporarily Disabled)
router.post('/biometric/login-challenge', (req, res) => {
  return res.status(501).json({
    error: 'Biometric authentication is temporarily unavailable pending server-side WebAuthn verification.',
    code: 'BIOMETRIC_UNAVAILABLE'
  });
});

// 10. WebAuthn Biometric Login Verification (Temporarily Disabled)
router.post('/biometric/login-verify', (req, res) => {
  return res.status(501).json({
    error: 'Biometric login is temporarily unavailable pending server-side WebAuthn verification.',
    code: 'BIOMETRIC_UNAVAILABLE'
  });
});

export default router;

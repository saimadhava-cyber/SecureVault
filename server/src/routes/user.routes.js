import express from 'express';
import bcrypt from 'bcryptjs';
import { dbOperations } from '../db/index.js';
import { vaultStorage } from '../services/vaultStorage.js';
import { auditLogger } from '../services/auditLogger.js';
import { authenticate } from '../middleware/auth.js';
import { config } from '../config.js';

const router = express.Router();

// 1. Change Password
router.put('/password', authenticate, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required.' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters long.' });
    }

    const user = dbOperations.get('SELECT id, password_hash FROM users WHERE id = ?', [req.user.id]);
    const isMatch = await bcrypt.compare(currentPassword, user.password_hash);

    if (!isMatch) {
      return res.status(401).json({ error: 'Current password is incorrect.' });
    }

    const salt = await bcrypt.genSalt(12);
    const newHash = await bcrypt.hash(newPassword, salt);

    dbOperations.run("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?", [newHash, req.user.id]);

    auditLogger.log({
      userId: req.user.id,
      actionType: 'PASSWORD_CHANGED',
      details: {},
      req
    });

    res.json({ message: 'Account password changed successfully.' });
  } catch (err) {
    next(err);
  }
});

// 2. Set or Update PIN
router.put('/pin', authenticate, async (req, res, next) => {
  try {
    const { pin, enabled } = req.body;

    if (enabled) {
      if (!pin || !/^\d{4,8}$/.test(pin)) {
        return res.status(400).json({ error: 'PIN must be between 4 and 8 digits.' });
      }

      const salt = await bcrypt.genSalt(10);
      const pinHash = await bcrypt.hash(pin, salt);

      dbOperations.run(
        "UPDATE users SET pin_hash = ?, pin_enabled = 1, updated_at = datetime('now') WHERE id = ?",
        [pinHash, req.user.id]
      );

      auditLogger.log({
        userId: req.user.id,
        actionType: 'PIN_CHANGED',
        details: { action: 'enabled' },
        req
      });

      return res.json({ message: 'PIN lock enabled successfully.', pinEnabled: true });
    } else {
      dbOperations.run(
        "UPDATE users SET pin_hash = NULL, pin_enabled = 0, updated_at = datetime('now') WHERE id = ?",
        [req.user.id]
      );

      auditLogger.log({
        userId: req.user.id,
        actionType: 'PIN_CHANGED',
        details: { action: 'disabled' },
        req
      });

      return res.json({ message: 'PIN lock disabled.', pinEnabled: false });
    }
  } catch (err) {
    next(err);
  }
});

// 3. Verify PIN (for quick unlock)
router.post('/verify-pin', authenticate, async (req, res, next) => {
  try {
    const { pin } = req.body;
    if (!pin) {
      return res.status(400).json({ error: 'PIN is required.' });
    }

    const user = dbOperations.get('SELECT pin_hash, pin_enabled FROM users WHERE id = ?', [req.user.id]);
    if (!user || !user.pin_enabled || !user.pin_hash) {
      return res.status(400).json({ error: 'PIN lock is not configured on this account.' });
    }

    const match = await bcrypt.compare(pin, user.pin_hash);
    if (!match) {
      return res.status(401).json({ error: 'Incorrect PIN.' });
    }

    auditLogger.log({
      userId: req.user.id,
      actionType: 'PIN_UNLOCKED',
      details: {},
      req
    });

    res.json({ message: 'PIN verified successfully.', valid: true });
  } catch (err) {
    next(err);
  }
});

// 4. Update Security Settings (Session Timeout, Biometrics)
router.put('/settings', authenticate, (req, res, next) => {
  try {
    const { sessionTimeoutMinutes, biometricEnabled } = req.body;

    let updates = [];
    let params = [];

    if (sessionTimeoutMinutes !== undefined) {
      const timeout = Math.max(1, Math.min(parseInt(sessionTimeoutMinutes, 10), 1440));
      updates.push('session_timeout_minutes = ?');
      params.push(timeout);
    }

    if (biometricEnabled !== undefined) {
      updates.push('biometric_enabled = ?');
      params.push(biometricEnabled ? 1 : 0);
    }

    if (updates.length > 0) {
      updates.push("updated_at = datetime('now')");
      params.push(req.user.id);
      dbOperations.run(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    res.json({ message: 'Security preferences updated.' });
  } catch (err) {
    next(err);
  }
});

// 5. Get Active Sessions
router.get('/sessions', authenticate, (req, res, next) => {
  try {
    const sessions = dbOperations.all(
      `SELECT id, device_info, ip_address, last_active_at, created_at, expires_at
       FROM user_sessions
       WHERE user_id = ?
       ORDER BY last_active_at DESC`,
      [req.user.id]
    );

    res.json({ sessions });
  } catch (err) {
    next(err);
  }
});

// 6. Revoke a Session
router.delete('/sessions/:id', authenticate, (req, res, next) => {
  try {
    dbOperations.run(
      'DELETE FROM user_sessions WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    res.json({ message: 'Session revoked successfully.' });
  } catch (err) {
    next(err);
  }
});

// 7. Delete Entire Account and All Encrypted Files
router.delete('/account', authenticate, async (req, res, next) => {
  try {
    const { confirmPassword } = req.body;
    if (!confirmPassword) {
      return res.status(400).json({ error: 'Please enter your password to confirm account deletion.' });
    }

    const user = dbOperations.get('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
    const isMatch = await bcrypt.compare(confirmPassword, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Password confirmation failed. Account not deleted.' });
    }

    // Retrieve all files owned by user and erase them from disk
    const files = dbOperations.all('SELECT storage_path FROM encrypted_files WHERE user_id = ?', [req.user.id]);
    files.forEach(f => {
      vaultStorage.deleteEncryptedFile(f.storage_path);
    });

    // Delete user (cascades to encrypted_files, activity_logs, user_sessions)
    dbOperations.run('DELETE FROM users WHERE id = ?', [req.user.id]);

    res.clearCookie('vault_token', {
      httpOnly: true,
      secure: config.isProduction,
      sameSite: 'lax'
    });
    res.json({ message: 'Your account and all associated encrypted vault files have been permanently erased.' });
  } catch (err) {
    next(err);
  }
});

export default router;

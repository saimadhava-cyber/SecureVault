import express from 'express';
import { auditLogger } from '../services/auditLogger.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// 1. Get Activity Logs
router.get('/', authenticate, (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '100', 10), 500);
    const actionFilter = req.query.action || null;

    const logs = auditLogger.getUserLogs(req.user.id, limit, actionFilter);

    // Parse JSON details safely
    const formatted = logs.map(l => {
      let detailsObj = {};
      try {
        detailsObj = JSON.parse(l.details || '{}');
      } catch (e) {
        detailsObj = { text: l.details };
      }
      return {
        id: l.id,
        actionType: l.action_type,
        details: detailsObj,
        ipAddress: l.ip_address,
        userAgent: l.user_agent,
        createdAt: l.created_at
      };
    });

    res.json({ logs: formatted });
  } catch (err) {
    next(err);
  }
});

// 2. Client-Reported Audit Event (e.g., client-side decryption completed)
router.post('/log', authenticate, (req, res, next) => {
  try {
    const { actionType, details = {} } = req.body;

    const allowedClientActions = [
      'FILE_DECRYPTED',
      'FILE_ENCRYPTED_LOCAL',
      'DECRYPTION_FAILED',
      'PIN_LOCKED',
      'PIN_UNLOCKED',
      'CLIPBOARD_COPIED'
    ];

    if (!allowedClientActions.includes(actionType)) {
      return res.status(400).json({ error: 'Invalid client audit action type.' });
    }

    auditLogger.log({
      userId: req.user.id,
      actionType,
      details,
      req
    });

    res.json({ message: 'Event logged.' });
  } catch (err) {
    next(err);
  }
});

// 3. Export Activity Logs
router.get('/export', authenticate, (req, res, next) => {
  try {
    const logs = auditLogger.getUserLogs(req.user.id, 1000);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="securevault-activity-audit.json"');
    res.json({
      exportDate: new Date().toISOString(),
      userId: req.user.id,
      totalEntries: logs.length,
      logs
    });
  } catch (err) {
    next(err);
  }
});

export default router;

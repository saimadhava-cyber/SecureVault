import { v4 as uuidv4 } from 'uuid';
import { dbOperations } from '../db/index.js';

export const auditLogger = {
  log({ userId, actionType, details = {}, req = null }) {
    try {
      const id = uuidv4();
      const ipAddress = req?.headers['x-forwarded-for'] || req?.socket?.remoteAddress || '127.0.0.1';
      const userAgent = req?.headers['user-agent'] || 'Unknown';

      // Strictly sanitize details to ensure no passwords or keys ever enter logs
      const sanitizedDetails = { ...details };
      delete sanitizedDetails.password;
      delete sanitizedDetails.newPassword;
      delete sanitizedDetails.oldPassword;
      delete sanitizedDetails.encryptionKey;
      delete sanitizedDetails.key;
      delete sanitizedDetails.pin;

      const detailsJson = JSON.stringify(sanitizedDetails);

      dbOperations.run(
        `INSERT INTO activity_logs (id, user_id, action_type, details, ip_address, user_agent, created_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
        [id, userId, actionType, detailsJson, ipAddress, userAgent]
      );
    } catch (err) {
      console.error('[AuditLogger] Failed to write audit log:', err.message);
    }
  },

  getUserLogs(userId, limit = 100, actionFilter = null) {
    if (actionFilter) {
      return dbOperations.all(
        `SELECT id, user_id, action_type, details, ip_address, user_agent, created_at
         FROM activity_logs
         WHERE user_id = ? AND action_type = ?
         ORDER BY created_at DESC
         LIMIT ?`,
        [userId, actionFilter, limit]
      );
    }

    return dbOperations.all(
      `SELECT id, user_id, action_type, details, ip_address, user_agent, created_at
       FROM activity_logs
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT ?`,
      [userId, limit]
    );
  }
};

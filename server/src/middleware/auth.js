import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { dbOperations } from '../db/index.js';

export function authenticate(req, res, next) {
  try {
    let token = null;

    // Check Authorization header: Bearer <token>
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    } else if (req.cookies && req.cookies.vault_token) {
      token = req.cookies.vault_token;
    }

    if (!token) {
      return res.status(401).json({
        error: 'Authentication required. No token provided.',
        code: 'NO_TOKEN'
      });
    }

    // Verify token
    jwt.verify(token, config.jwtSecret, (err, decoded) => {
      if (err) {
        if (err.name === 'TokenExpiredError') {
          return res.status(401).json({
            error: 'Session has expired. Please log in again.',
            code: 'TOKEN_EXPIRED'
          });
        }
        return res.status(401).json({
          error: 'Invalid authentication token.',
          code: 'INVALID_TOKEN'
        });
      }

      // Query database for user
      const user = dbOperations.get(
        `SELECT id, email, full_name, pin_enabled, session_timeout_minutes, biometric_enabled, created_at 
         FROM users WHERE id = ?`,
        [decoded.userId]
      );

      if (!user) {
        return res.status(401).json({
          error: 'User account not found or removed.',
          code: 'USER_NOT_FOUND'
        });
      }

      req.user = user;
      req.token = token;
      next();
    });
  } catch (err) {
    return res.status(500).json({ error: 'Internal authentication error: ' + err.message });
  }
}

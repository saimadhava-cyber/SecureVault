import rateLimit from 'express-rate-limit';

// Strict limiter for authentication and sensitive operations
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many login or registration attempts. Please try again in 15 minutes.',
    code: 'RATE_LIMIT_EXCEEDED'
  }
});

// General API rate limiter
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many API requests from this IP. Please slow down.',
    code: 'RATE_LIMIT_EXCEEDED'
  }
});

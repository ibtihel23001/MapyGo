import rateLimit from 'express-rate-limit';

/** Tight limit for auth endpoints (login, forgot-password) */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later' },
});

/** General API limiter */
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 min
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later' },
});

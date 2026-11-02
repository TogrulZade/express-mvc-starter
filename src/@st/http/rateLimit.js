import { rateLimit } from "express-rate-limit";

const MINUTE = 60 * 1000;

// Same JSON shape as the rest of the API. RateLimit-* headers tell clients when they can retry.
export const limiter = ({ windowMs, limit, message, ...options }) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    handler: (req, res, next, opts) =>
      res.status(opts.statusCode).json({ success: false, message }),
    ...options,
  });

// Every /api request: 300 per IP every 15 minutes.
export const apiLimiter = limiter({
  windowMs: 15 * MINUTE,
  limit: Number(process.env.RATE_LIMIT_MAX || 300),
  message: "Too many requests, please try again later",
});

// Login and register: 10 attempts per IP every 15 minutes, to slow down password guessing.
// Successful logins don't count, so a user who types the right password isn't locked out.
export const authLimiter = limiter({
  windowMs: 15 * MINUTE,
  limit: Number(process.env.AUTH_RATE_LIMIT_MAX || 10),
  message: "Too many login attempts, please try again in 15 minutes",
  skipSuccessfulRequests: true,
});

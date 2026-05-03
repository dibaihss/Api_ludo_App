require('dotenv').config();

const toNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

module.exports = {
  jwtSecret: process.env.JWT_SECRET || 'your-super-secret-jwt-key',
  jwtExpiresIn: '24h',
  jwtAlgorithm: 'HS256',
  rateLimitWindowMs: toNumber(process.env.GUEST_LOGIN_RATE_LIMIT_WINDOW_MS, 60000),
  rateLimitMaxRequests: toNumber(process.env.GUEST_LOGIN_RATE_LIMIT_MAX_REQUESTS, 12),
  sessionCreateWindowMs: toNumber(process.env.SESSION_CREATE_WINDOW_MS, 600000),
  sessionCreateMaxPerUser: toNumber(process.env.SESSION_CREATE_MAX_PER_USER, 8),
  sessionCreateMaxPerIp: toNumber(process.env.SESSION_CREATE_MAX_PER_IP, 8),
  sessionActiveCapRegistered: toNumber(process.env.SESSION_ACTIVE_CAP_REGISTERED, 8),
  sessionActiveCapGuest: toNumber(process.env.SESSION_ACTIVE_CAP_GUEST, 4),
  sessionTtlWaitingMinutes: toNumber(process.env.SESSION_TTL_WAITING_MINUTES, 30),
  sessionTtlInProgressMinutes: toNumber(process.env.SESSION_TTL_IN_PROGRESS_MINUTES, 240),
  sessionCleanupIntervalMs: toNumber(process.env.SESSION_CLEANUP_INTERVAL_MS, 600000)
};

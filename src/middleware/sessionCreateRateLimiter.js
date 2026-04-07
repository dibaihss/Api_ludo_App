const authConfig = require('../config/auth');

const userRequestCounts = new Map();
const ipRequestCounts = new Map();

const filterWindow = (timestamps, windowStart) => timestamps.filter((time) => time > windowStart);

const sessionCreateRateLimiter = (req, res, next) => {
  const now = Date.now();
  const windowStart = now - authConfig.sessionCreateWindowMs;
  const userId = req.user && req.user.userId ? String(req.user.userId) : null;
  const clientIp = req.ip || req.connection.remoteAddress || 'unknown';

  if (userId) {
    const existingUserRequests = userRequestCounts.get(userId) || [];
    const activeUserRequests = filterWindow(existingUserRequests, windowStart);

    if (activeUserRequests.length >= authConfig.sessionCreateMaxPerUser) {
      return res.status(429).json({
        message: 'Too many session creation attempts. Please try again later.'
      });
    }

    activeUserRequests.push(now);
    userRequestCounts.set(userId, activeUserRequests);
  }

  const existingIpRequests = ipRequestCounts.get(clientIp) || [];
  const activeIpRequests = filterWindow(existingIpRequests, windowStart);

  if (activeIpRequests.length >= authConfig.sessionCreateMaxPerIp) {
    return res.status(429).json({
      message: 'Too many session creation attempts from this network. Please try again later.'
    });
  }

  activeIpRequests.push(now);
  ipRequestCounts.set(clientIp, activeIpRequests);

  next();
};

module.exports = sessionCreateRateLimiter;

const authConfig = require('../config/auth');

const requestCounts = new Map();

const rateLimiter = (req, res, next) => {
  const clientIp = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  const windowStart = now - authConfig.rateLimitWindowMs;

  if (!requestCounts.has(clientIp)) {
    requestCounts.set(clientIp, []);
  }

  const requests = requestCounts.get(clientIp).filter(timestamp => timestamp > windowStart);
  requestCounts.set(clientIp, requests);

  if (requests.length >= authConfig.rateLimitMaxRequests) {
    return res.status(429).json('Too many guest accounts created. Please try again later.');
  }

  requests.push(now);
  next();
};

module.exports = rateLimiter;

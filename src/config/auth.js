require('dotenv').config();

module.exports = {
  jwtSecret: process.env.JWT_SECRET || 'your-super-secret-jwt-key',
  jwtExpiresIn: '24h',
  jwtAlgorithm: 'HS256',
  rateLimitWindowMs: 60000,
  rateLimitMaxRequests: 2
};

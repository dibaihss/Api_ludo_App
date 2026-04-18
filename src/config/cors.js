const productionAllowedOrigins = ['https://strategic.expo.app'];

const developmentAllowedOrigins = [
  'http://localhost:8081',
  'http://127.0.0.1:8081',
  'http://localhost:8083',
  'http://127.0.0.1:8083',
  'http://localhost:19006',
  'http://127.0.0.1:19006',
  ...productionAllowedOrigins
];

const allowedOrigins = process.env.NODE_ENV === 'production'
  ? productionAllowedOrigins
  : developmentAllowedOrigins;

const normalizeOrigin = (origin) => origin.replace(/\/$/, '');

const isAllowedOrigin = (origin) => {
  if (!origin) {
    return true;
  }

  return allowedOrigins.includes(normalizeOrigin(origin));
};

module.exports = {
  allowedOrigins,
  isAllowedOrigin
};
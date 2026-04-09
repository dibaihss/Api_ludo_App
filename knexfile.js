require('dotenv').config();
const { buildConnection } = require('./src/config/database-factory');

const baseConfig = {
  client: 'pg',
  connection: buildConnection(process.env),
  migrations: {
    directory: './migrations'
  }
};

const config = {
  development: {
    ...baseConfig
  },
  production: {
    ...baseConfig
  },
  test: {
    ...baseConfig
  },
  local: {
    ...baseConfig
  },
  staging: {
    ...baseConfig
  }
};

const currentEnv = process.env.NODE_ENV;
if (currentEnv && !config[currentEnv]) {
  config[currentEnv] = config.development;
}

module.exports = config;

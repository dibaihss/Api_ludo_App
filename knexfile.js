require('dotenv').config();

const rawDatabaseUrl = process.env.DATABASE_URL;
const hasDatabaseUrl = Boolean(rawDatabaseUrl);
const isProduction = process.env.NODE_ENV === 'production';

const isValidDatabaseUrl = (value) => {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'postgres:' || parsed.protocol === 'postgresql:';
  } catch (error) {
    return false;
  }
};

const useDatabaseUrl = isValidDatabaseUrl(rawDatabaseUrl);
const useSsl = useDatabaseUrl || isProduction || process.env.DB_SSL === 'true';

const buildConnection = () => {
  if (hasDatabaseUrl && !useDatabaseUrl) {
    console.warn('DATABASE_URL is set but invalid. Falling back to DB_* variables.');
  }

  if (useDatabaseUrl) {
    return {
      connectionString: rawDatabaseUrl,
      ssl: useSsl ? { rejectUnauthorized: false } : false
    };
  }

  return {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'ludo',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    ssl: useSsl ? { rejectUnauthorized: false } : false
  };
};

const baseConfig = {
  client: 'pg',
  connection: buildConnection(),
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

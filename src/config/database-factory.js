const knex = require('knex');

const isProductionEnv = (env = process.env) => env.NODE_ENV === 'production';

const isValidDatabaseUrl = (value) => {
  if (!value) {
    return false;
  }

  try {
    const parsed = new URL(value);
    return parsed.protocol === 'postgres:' || parsed.protocol === 'postgresql:';
  } catch (error) {
    return false;
  }
};

const buildConnection = (env = process.env) => {
  const rawDatabaseUrl = env.DATABASE_URL;
  const isDatabaseUrlDisabled = rawDatabaseUrl === 'disabled';
  const hasDatabaseUrl = Boolean(rawDatabaseUrl) && !isDatabaseUrlDisabled;
  const useDatabaseUrl = isValidDatabaseUrl(rawDatabaseUrl);
  const useSsl = useDatabaseUrl || isProductionEnv(env) || env.DB_SSL === 'true';

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
    host: env.DB_HOST || 'localhost',
    port: env.DB_PORT || 5432,
    database: env.DB_NAME || 'ludo',
    user: env.DB_USER || 'postgres',
    password: env.DB_PASSWORD || 'password',
    ssl: useSsl ? { rejectUnauthorized: false } : false
  };
};

const createKnex = (env = process.env, overrides = {}) => knex({
  client: 'pg',
  connection: buildConnection(env),
  pool: {
    min: 2,
    max: 10
  },
  ...overrides
});

module.exports = {
  buildConnection,
  createKnex,
  isValidDatabaseUrl
};

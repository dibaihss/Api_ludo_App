require('dotenv').config();

const isProduction = process.env.NODE_ENV === 'production';
const rawDatabaseUrl = process.env.DATABASE_URL;
const isDatabaseUrlDisabled = rawDatabaseUrl === 'disabled';
const hasDatabaseUrl = Boolean(rawDatabaseUrl) && !isDatabaseUrlDisabled;

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

if (hasDatabaseUrl && !useDatabaseUrl) {
  console.warn('DATABASE_URL is set but invalid. Falling back to DB_* variables.');
}

const connection = useDatabaseUrl
  ? {
      connectionString: rawDatabaseUrl,
      ssl: useSsl ? { rejectUnauthorized: false } : false
    }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'ludo',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'password',
      ssl: useSsl ? { rejectUnauthorized: false } : false
    };

const knex = require('knex')({
  client: 'pg',
  connection,
  pool: {
    min: 2,
    max: 10
  }
});

module.exports = knex;

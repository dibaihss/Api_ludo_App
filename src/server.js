require('dotenv').config();
const app = require('./app');
const knex = require('./config/database');
const Session = require('./models/Session');
const authConfig = require('./config/auth');

const PORT = process.env.PORT || 3000;
const shouldResetDbOnStart = process.env.RESET_DB_ON_START === 'true';
let cleanupTimer = null;

const runSessionCleanup = async () => {
  try {
    const deletedCount = await Session.deleteExpiredEmptySessions();
    if (deletedCount > 0) {
      console.log(`Session cleanup removed ${deletedCount} expired sessions.`);
    }
  } catch (error) {
    console.error('Session cleanup failed:', error.message);
  }
};

async function startServer() {
  try {
    if (shouldResetDbOnStart) {
      console.warn('RESET_DB_ON_START=true detected. Dropping all migrated tables and recreating schema...');
      await knex.migrate.rollback(undefined, true);
      await knex.migrate.latest();
      console.log('Database schema reset complete.');
    }

    await runSessionCleanup();
    cleanupTimer = setInterval(runSessionCleanup, authConfig.sessionCleanupIntervalMs);
    cleanupTimer.unref();

    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Server startup failed:', error.message);
    process.exit(1);
  }
}

startServer();

require('dotenv').config();
const app = require('./app');
const knex = require('./config/database');

const PORT = process.env.PORT || 3000;
const shouldResetDbOnStart = process.env.RESET_DB_ON_START === 'true';

async function startServer() {
  try {
    if (shouldResetDbOnStart) {
      console.warn('RESET_DB_ON_START=true detected. Dropping all migrated tables and recreating schema...');
      await knex.migrate.rollback(undefined, true);
      await knex.migrate.latest();
      console.log('Database schema reset complete.');
    }

    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Server startup failed:', error.message);
    process.exit(1);
  }
}

startServer();

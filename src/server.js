require('dotenv').config();
const http = require('node:http');
const { Server } = require('socket.io');
const authConfig = require('./config/auth');
const { allowedOrigins } = require('./config/cors');
const { ensureDatabaseReady, formatErrorMessage } = require('./startup/localPostgresBootstrap');

const PORT = process.env.PORT || 3000;
const shouldResetDbOnStart = process.env.RESET_DB_ON_START === 'true';
let cleanupTimer = null;

const runSessionCleanup = async (Session) => {
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
  let knex = null;
  let shutdownLocalPostgres = null;
  let server = null;

  try {
    ({ shutdownLocalPostgres } = await ensureDatabaseReady());

    const app = require('./app');
    knex = require('./config/database');
    const Session = require('./models/Session');
    const DataClient = require('./socket/data-client');
    const { registerCreateItemHandler } = require('./socket/create-item-handler');
    const { registerMessageHandler } = require('./socket/message-handler');
    const { registerSessionWebsocketHandlers } = require('./socket/session-websocket-handler');

    if (shouldResetDbOnStart) {
      console.warn('RESET_DB_ON_START=true detected. Dropping all migrated tables and recreating schema...');
      await knex.migrate.rollback(undefined, true);
      await knex.migrate.latest();
      console.log('Database schema reset complete.');
    }

    await runSessionCleanup(Session);
    cleanupTimer = setInterval(() => {
      void runSessionCleanup(Session);
    }, authConfig.sessionCleanupIntervalMs);
    cleanupTimer.unref();

    server = http.createServer(app);
    const io = new Server(server, {
      transports: ['websocket', 'transport'],
      cors: {
        origin: allowedOrigins,
        methods: ['GET', 'POST', 'PUT'],
      }
    });

    io.on('connection', (socket) => {
      socket.on('start', async () => {
        try {
          await DataClient.start((message) => io.emit('new_message', message));
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          io.emit('new_message', `Error:\t${errorMessage}`);
        }
      });

      registerCreateItemHandler(io, socket, DataClient);
      registerMessageHandler(socket, (message) => io.emit('new_message', message));
      registerSessionWebsocketHandlers(io, socket);
    });

    io.on('error', (_, error) => console.error(`Socket error: ${error}`));

    let isShuttingDown = false;
    const shutdown = async (signal) => {
      if (isShuttingDown) {
        return;
      }

      isShuttingDown = true;

      if (signal) {
        console.log(`Received ${signal}. Shutting down...`);
      }

      if (cleanupTimer) {
        clearInterval(cleanupTimer);
        cleanupTimer = null;
      }

      if (server) {
        await new Promise((resolve) => {
          server.close(() => resolve());
        });
      }

      if (knex) {
        await knex.destroy();
      }

      if (shutdownLocalPostgres) {
        await shutdownLocalPostgres();
      }

      process.exit(0);
    };

    process.once('SIGINT', () => {
      void shutdown('SIGINT');
    });

    process.once('SIGTERM', () => {
      void shutdown('SIGTERM');
    });

    await new Promise((resolve) => {
      server.listen(PORT, resolve);
    });
    console.log(`Server is running on port ${PORT}`);
  } catch (error) {
    console.error('Server startup failed:', formatErrorMessage(error));
    if (cleanupTimer) {
      clearInterval(cleanupTimer);
      cleanupTimer = null;
    }
    if (knex) {
      await knex.destroy().catch(() => {});
    }
    if (shutdownLocalPostgres) {
      await shutdownLocalPostgres().catch(() => {});
    }
    process.exit(1);
  }
}

startServer();

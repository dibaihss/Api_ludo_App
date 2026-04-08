require('dotenv').config();
const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const knex = require('./config/database');
const Session = require('./models/Session');
const authConfig = require('./config/auth');
const DataClient = require('./socket/data-client');
const { registerCreateItemHandler } = require('./socket/create-item-handler');
const { registerMessageHandler } = require('./socket/message-handler');
const { registerSessionWebsocketHandlers } = require('./socket/session-websocket-handler');

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

    const server = http.createServer(app);
    const io = new Server(server, {
      transports: ['websocket', 'transport'],
      cors: {
        origin: 'localhost:8081',
        methods: ['GET', 'POST']
      }
    });

    io.on('connection', (socket) => {
      console.log(`Connected: ${socket.id}`);

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

    io.on('error', (_, error) => console.log(`Error: ${error}`));
    io.on('disconnect', (_, reason) => console.log(`Disconnected: ${reason}`));

    server.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Server startup failed:', error.message);
    process.exit(1);
  }
}

startServer();

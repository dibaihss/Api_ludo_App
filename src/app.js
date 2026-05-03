require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { isAllowedOrigin } = require('./config/cors');
const userRoutes = require('./routes/users');
const sessionRoutes = require('./routes/sessions');

const app = express();

app.use(
  cors({
    origin(origin, callback) {
      if (isAllowedOrigin(origin)) {
        return callback(null, true);
      }
      console.warn(`[CORS BLOCKED] Origin: "${origin}"`);
      return callback(new Error('CORS: Origin not allowed'));
    }
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/static', express.static(path.join(__dirname, '..', 'static')));

app.get('/', (req, res) => {
  res.json({ message: 'Strategic Ludo Game Backend API' });
});

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'Strategic Ludo Game Backend API'
  });
});

app.use('/api', userRoutes);
app.use('/api', sessionRoutes);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Internal Server Error' });
});

app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

module.exports = app;

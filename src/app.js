require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const userRoutes = require('./routes/users');
const sessionRoutes = require('./routes/sessions');

const app = express();

const allowedOrigins = ['http://localhost:8081', "https://strategic.expo.app"];

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
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

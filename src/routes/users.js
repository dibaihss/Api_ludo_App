const express = require('express');
const { body } = require('express-validator');
const usersController = require('../controllers/usersController');
const authenticateToken = require('../middleware/auth');
const rateLimiter = require('../middleware/rateLimiter');

const router = express.Router();

router.get('/users', usersController.getAllUsers);

router.get('/users/:id', usersController.getUserById);

router.post('/users', [
  body('name').notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
], usersController.createUser);

router.delete('/users/:id', authenticateToken, usersController.deleteUser);

router.delete('/guest-users/:id', usersController.deleteUser);

router.put('/users/:id/status', authenticateToken, [
  body('status').isBoolean().withMessage('Status must be a boolean')
], usersController.updateUserStatus);

router.post('/login', [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required')
], usersController.login);

router.post('/guest-login', rateLimiter, usersController.guestLogin);

module.exports = router;

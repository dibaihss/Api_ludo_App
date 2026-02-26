const express = require('express');
const { body } = require('express-validator');
const sessionsController = require('../controllers/sessionsController');
const authenticateToken = require('../middleware/auth');

const router = express.Router();

router.get('/sessions', sessionsController.getAllSessions);

router.get('/sessions/available', sessionsController.getAvailableSessions);

router.get('/sessions/status/:status', sessionsController.getSessionsByStatus);

router.get('/sessions/:id', sessionsController.getSessionById);

router.post('/sessions', authenticateToken, [
  body('name').notEmpty().withMessage('Name is required'),
  body('status').optional().isString(),
  body('maxPlayers').optional().isInt({ min: 1, max: 4 })
], sessionsController.createSession);

router.put('/sessions/:id', authenticateToken, [
  body('name').optional().isString(),
  body('status').optional().isString(),
  body('maxPlayers').optional().isInt({ min: 1, max: 4 })
], sessionsController.updateSession);

router.delete('/sessions/:id', authenticateToken, sessionsController.deleteSession);

router.post('/sessions/:sessionId/users/:userId', authenticateToken, sessionsController.addUserToSession);

router.delete('/sessions/:sessionId/users/:userId', authenticateToken, sessionsController.removeUserFromSession);

router.get('/sessions/:sessionId/users', sessionsController.getSessionUsers);

module.exports = router;

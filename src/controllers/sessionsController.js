const Session = require('../models/Session');
const authConfig = require('../config/auth');

const ALLOWED_STATUSES = new Set(['waiting', 'in_progress', 'completed']);

const getSessionExpiry = (status) => {
  const now = new Date();
  const minutesToAdd = status === 'in_progress'
    ? authConfig.sessionTtlInProgressMinutes
    : authConfig.sessionTtlWaitingMinutes;

  return new Date(now.getTime() + minutesToAdd * 60 * 1000);
};

const sessionsController = {
  async getAllSessions(req, res) {
    try {
      const sessions = await Session.findAll();
      res.status(200).json(sessions);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  async getSessionById(req, res) {
    try {
      const session = await Session.findById(req.params.id);
      if (!session) {
        return res.status(404).json({ message: 'Session not found' });
      }
      res.status(200).json(session);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  async getSessionWithUsers(req, res) {
    try {
      const sessionWithUsers = await Session.findByIdWithUsers(req.params.id);
      if (!sessionWithUsers) {
        return res.status(404).json({ message: 'Session not found' });
      }
      res.status(200).json(sessionWithUsers);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  async createSession(req, res) {
    try {
      const { name, status, maxPlayers } = req.body;
      if (status && !ALLOWED_STATUSES.has(status)) {
        return res.status(400).json({ message: 'Invalid status value' });
      }

      const ownerUserId = req.user.userId;
      const isGuest = Boolean(req.user.isGuest);
      const activeCap = isGuest
        ? authConfig.sessionActiveCapGuest
        : authConfig.sessionActiveCapRegistered;
      const activeSessionCount = await Session.countActiveByOwner(ownerUserId);

      if (activeSessionCount >= activeCap) {
        return res.status(429).json({
          message: `Session limit reached. You can have up to ${activeCap} active sessions.`
        });
      }

      const sessionStatus = status || 'waiting';
      const session = await Session.create({
        name,
        owner_user_id: ownerUserId,
        status: sessionStatus,
        max_players: maxPlayers || 4,
        current_players: 0,
        expires_at: getSessionExpiry(sessionStatus),
        last_activity_at: new Date()
      });

      res.status(201).json({
        id: session.id,
        name: session.name,
        status: session.status,
        maxPlayers: session.max_players,
        currentPlayers: session.current_players,
        createdAt: session.created_at,
        updatedAt: session.updated_at
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  async updateSession(req, res) {
    try {
      const session = await Session.findById(req.params.id);
      if (!session) {
        return res.status(404).json({ message: 'Session not found' });
      }

      const { name, status, maxPlayers } = req.body;
      if (status && !ALLOWED_STATUSES.has(status)) {
        return res.status(400).json({ message: 'Invalid status value' });
      }

      const updatedSession = await Session.update(req.params.id, {
        name: name || session.name,
        status: status || session.status,
        max_players: maxPlayers || session.max_players,
        expires_at: getSessionExpiry(status || session.status)
      });

      res.status(200).json({
        id: updatedSession.id,
        name: updatedSession.name,
        status: updatedSession.status,
        maxPlayers: updatedSession.max_players,
        currentPlayers: updatedSession.current_players,
        createdAt: updatedSession.created_at,
        updatedAt: updatedSession.updated_at
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  async deleteSession(req, res) {
    try {
      const session = await Session.findById(req.params.id);
      if (!session) {
        return res.status(404).json({ message: 'Session not found' });
      }
      await Session.delete(req.params.id);
      res.status(200).json({ message: 'Session deleted successfully' });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  async getAvailableSessions(req, res) {
    try {
      const sessions = await Session.findAvailable();
      res.status(200).json(sessions);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  async getSessionsByStatus(req, res) {
    try {
      const sessions = await Session.findByStatus(req.params.status);
      res.status(200).json(sessions);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  async addUserToSession(req, res) {
    try {
      const { sessionId, userId } = req.params;
      
      const session = await Session.findById(sessionId);
      if (!session) {
        return res.status(404).json({ message: 'Session not found' });
      }

      if (session.current_players >= session.max_players) {
        return res.status(400).json({ message: 'Session is full' });
      }

      await Session.addUser(sessionId, userId);
      await Session.update(sessionId, { expires_at: getSessionExpiry(session.status) });

      res.status(200).json({
        success: true,
        message: 'User added to session successfully'
      });
    } catch (error) {
      if (error.code === '23503') {
        return res.status(404).json({ message: 'User not found' });
      }
      if (error.message.includes('duplicate key')) {
        return res.status(400).json({ message: 'User already in session' });
      }
      res.status(500).json({ message: error.message });
    }
  },

  async removeUserFromSession(req, res) {
    try {
      const { sessionId, userId } = req.params;
      const requesterId = req.user?.userId;
      
      const session = await Session.findById(sessionId);
      if (!session) {
        return res.status(404).json({ message: 'Session not found' });
      }

      const isSelfRemoval = String(requesterId) === String(userId);
      const isOwner = String(session.owner_user_id) === String(requesterId);

      if (!isSelfRemoval && !isOwner) {
        return res.status(403).json({ message: 'Only the session owner can remove another player' });
      }

      await Session.removeUser(sessionId, userId);
      await Session.update(sessionId, { expires_at: getSessionExpiry(session.status) });

      res.status(200).json({
        success: true,
        message: 'User removed from session successfully'
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  async getSessionUsers(req, res) {
    try {
      const session = await Session.findById(req.params.sessionId);
      if (!session) {
        return res.status(404).json({ message: 'Session not found' });
      }

      const users = await Session.getUsers(req.params.sessionId);
      res.status(200).json(users);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
};

module.exports = sessionsController;

const db = require('../config/database');

const ACTIVE_SESSION_STATUSES = ['waiting', 'in_progress'];

const Session = {
  async findAll() {
    return db('sessions')
      .where('expires_at', '>', db.fn.now())
      .select('*');
  },

  async findById(id) {
    const sessions = await db('sessions')
      .where({ id })
      .where('expires_at', '>', db.fn.now());
    return sessions[0];
  },

  async create(sessionData) {
    const [session] = await db('sessions').insert(sessionData).returning('*');
    return session;
  },

  async update(id, sessionData) {
    const [session] = await db('sessions')
      .where({ id })
      .update({
        ...sessionData,
        updated_at: db.fn.now(),
        last_activity_at: db.fn.now()
      })
      .returning('*');
    return session;
  },

  async delete(id) {
    return db('sessions').where({ id }).del();
  },

  async findAvailable() {
    return db('sessions')
      .whereRaw('current_players < max_players')
      .where('expires_at', '>', db.fn.now());
  },

  async findByStatus(status) {
    return db('sessions')
      .where({ status })
      .where('expires_at', '>', db.fn.now());
  },

  async countActiveByOwner(ownerUserId) {
    const result = await db('sessions')
      .count('* as count')
      .where({ owner_user_id: ownerUserId })
      .whereIn('status', ACTIVE_SESSION_STATUSES)
      .where('expires_at', '>', db.fn.now());

    return Number(result[0].count) || 0;
  },

  async addUser(sessionId, userId) {
    await db('session_users').insert({ session_id: sessionId, user_id: userId });
    const [session] = await db('sessions')
      .where({ id: sessionId })
      .update({
        current_players: db.raw('current_players + 1'),
        updated_at: db.fn.now(),
        last_activity_at: db.fn.now()
      })
      .returning('*');
    return session;
  },

  async removeUser(sessionId, userId) {
    await db('session_users').where({ session_id: sessionId, user_id: userId }).del();
    const [session] = await db('sessions')
      .where({ id: sessionId })
      .update({
        current_players: db.raw('GREATEST(current_players - 1, 0)'),
        updated_at: db.fn.now(),
        last_activity_at: db.fn.now()
      })
      .returning('*');
    return session;
  },

  async getUsers(sessionId) {
    return db('session_users')
      .join('users', 'session_users.user_id', 'users.id')
      .where({ session_id: sessionId })
      .select('users.id', 'users.name', 'users.email', 'users.status', 'users.is_guest', 'users.created_at');
  },

  async findByIdWithUsers(id) {
    const session = await db('sessions')
      .where({ id })
      .where('expires_at', '>', db.fn.now())
      .first();

    if (!session) {
      return null;
    }

    const users = await db('session_users')
      .join('users', 'session_users.user_id', 'users.id')
      .where({ session_id: id })
      .select('users.id', 'users.name', 'users.email', 'users.status', 'users.is_guest', 'users.created_at');

    return {
      ...session,
      users
    };
  },

  async deleteExpiredEmptySessions() {
    return db('sessions')
      .where('expires_at', '<=', db.fn.now())
      .andWhere({ current_players: 0 })
      .del();
  }
};

module.exports = Session;

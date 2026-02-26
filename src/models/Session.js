const db = require('../config/database');

const Session = {
  async findAll() {
    return db('sessions').select('*');
  },

  async findById(id) {
    const sessions = await db('sessions').where({ id });
    return sessions[0];
  },

  async create(sessionData) {
    const [session] = await db('sessions').insert(sessionData).returning('*');
    return session;
  },

  async update(id, sessionData) {
    const [session] = await db('sessions').where({ id }).update({ ...sessionData, updated_at: db.fn.now() }).returning('*');
    return session;
  },

  async delete(id) {
    return db('sessions').where({ id }).del();
  },

  async findAvailable() {
    return db('sessions').whereRaw('current_players < max_players');
  },

  async findByStatus(status) {
    return db('sessions').where({ status });
  },

  async addUser(sessionId, userId) {
    await db('session_users').insert({ session_id: sessionId, user_id: userId });
    const [session] = await db('sessions').where({ id: sessionId }).update({ current_players: db.raw('current_players + 1'), updated_at: db.fn.now() }).returning('*');
    return session;
  },

  async removeUser(sessionId, userId) {
    await db('session_users').where({ session_id: sessionId, user_id: userId }).del();
    const [session] = await db('sessions').where({ id: sessionId }).update({ current_players: db.raw('current_players - 1'), updated_at: db.fn.now() }).returning('*');
    return session;
  },

  async getUsers(sessionId) {
    return db('session_users')
      .join('users', 'session_users.user_id', 'users.id')
      .where({ session_id: sessionId })
      .select('users.id', 'users.name', 'users.email', 'users.status', 'users.is_guest', 'users.created_at');
  }
};

module.exports = Session;

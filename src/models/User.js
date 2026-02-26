const db = require('../config/database');

const User = {
  async findAll() {
    return db('users').select('id', 'name', 'email', 'status', 'is_guest', 'created_at');
  },

  async findById(id) {
    const users = await db('users').where({ id }).select('id', 'name', 'email', 'status', 'is_guest', 'created_at');
    return users[0];
  },

  async findByEmail(email) {
    const users = await db('users').where({ email });
    return users[0];
  },

  async create(userData) {
    const [user] = await db('users').insert(userData).returning(['id', 'name', 'email', 'status', 'is_guest', 'created_at']);
    return user;
  },

  async update(id, userData) {
    const [user] = await db('users').where({ id }).update(userData).returning(['id', 'name', 'email', 'status', 'is_guest', 'created_at']);
    return user;
  },

  async delete(id) {
    return db('users').where({ id }).del();
  },

  async updateStatus(id, status) {
    const [user] = await db('users').where({ id }).update({ status, last_activity: db.fn.now() }).returning(['id', 'name', 'email', 'status', 'is_guest', 'created_at']);
    return user;
  }
};

module.exports = User;

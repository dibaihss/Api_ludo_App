const db = require('../../src/config/database');

const truncateAllTables = async () => {
  await db.raw('TRUNCATE TABLE session_users, sessions, users RESTART IDENTITY CASCADE');
};

const createGuestUser = async (overrides = {}) => {
  const [user] = await db('users')
    .insert({
      name: overrides.name || 'Integration Guest',
      status: overrides.status !== undefined ? overrides.status : true,
      is_guest: overrides.is_guest !== undefined ? overrides.is_guest : true,
      email: overrides.email || null,
      password: overrides.password || null,
      last_activity: overrides.last_activity || null
    })
    .returning('*');

  return user;
};

module.exports = {
  db,
  truncateAllTables,
  createGuestUser
};

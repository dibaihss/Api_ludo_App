const request = require('supertest');
const app = require('../../src/app');
const { db, truncateAllTables, createGuestUser } = require('./dbTestUtils');

describe('Session with users API integration', () => {
  beforeAll(async () => {
    await db.migrate.latest();
  });

  beforeEach(async () => {
    await truncateAllTables();
  });

  afterAll(async () => {
    await db.destroy();
  });

  it('returns session with related users', async () => {
    const owner = await createGuestUser({ name: 'Owner' });
    const user1 = await createGuestUser({ name: 'Player One' });
    const user2 = await createGuestUser({ name: 'Player Two' });

    const [session] = await db('sessions')
      .insert({
        name: 'Room A',
        owner_user_id: owner.id,
        status: 'waiting',
        max_players: 4,
        current_players: 2,
        expires_at: new Date(Date.now() + 30 * 60 * 1000),
        last_activity_at: new Date()
      })
      .returning('*');

    await db('session_users').insert([
      { session_id: session.id, user_id: user1.id },
      { session_id: session.id, user_id: user2.id }
    ]);

    const response = await request(app).get(`/api/sessions/${session.id}/with-users`);

    expect(response.status).toBe(200);
    expect(response.body.id).toBe(session.id);
    expect(response.body.name).toBe('Room A');
    expect(Array.isArray(response.body.users)).toBe(true);
    expect(response.body.users).toHaveLength(2);
    expect(response.body).not.toHaveProperty('session');
    expect(response.body.users.map((u) => u.id).sort((a, b) => a - b)).toEqual([user1.id, user2.id].sort((a, b) => a - b));
  });

  it('returns session with empty users array when session has no users', async () => {
    const owner = await createGuestUser({ name: 'Owner Empty' });

    const [session] = await db('sessions')
      .insert({
        name: 'Room Empty',
        owner_user_id: owner.id,
        status: 'waiting',
        max_players: 4,
        current_players: 0,
        expires_at: new Date(Date.now() + 30 * 60 * 1000),
        last_activity_at: new Date()
      })
      .returning('*');

    const response = await request(app).get(`/api/sessions/${session.id}/with-users`);

    expect(response.status).toBe(200);
    expect(response.body.id).toBe(session.id);
    expect(response.body.users).toEqual([]);
  });

  it('returns 404 when session does not exist', async () => {
    const response = await request(app).get('/api/sessions/999999/with-users');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: 'Session not found' });
  });

  it('returns 404 for expired session', async () => {
    const owner = await createGuestUser({ name: 'Owner Expired' });

    const [session] = await db('sessions')
      .insert({
        name: 'Expired Room',
        owner_user_id: owner.id,
        status: 'waiting',
        max_players: 4,
        current_players: 0,
        expires_at: new Date(Date.now() - 5 * 60 * 1000),
        last_activity_at: new Date(Date.now() - 5 * 60 * 1000)
      })
      .returning('*');

    const response = await request(app).get(`/api/sessions/${session.id}/with-users`);

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: 'Session not found' });
  });
});

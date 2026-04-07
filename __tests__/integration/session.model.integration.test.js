const Session = require('../../src/models/Session');
const { db, truncateAllTables, createGuestUser } = require('./dbTestUtils');

describe('Session model integration (real database)', () => {
  beforeAll(async () => {
    await db.migrate.latest();
  });

  beforeEach(async () => {
    await truncateAllTables();
  });

  afterAll(async () => {
    await db.destroy();
  });

  it('creates a session row and excludes expired sessions from findAll', async () => {
    const owner = await createGuestUser({ name: 'Owner 1' });

    const activeSession = await Session.create({
      name: 'Active Session',
      owner_user_id: owner.id,
      status: 'waiting',
      max_players: 4,
      current_players: 0,
      expires_at: new Date(Date.now() + 30 * 60 * 1000),
      last_activity_at: new Date()
    });

    await Session.create({
      name: 'Expired Session',
      owner_user_id: owner.id,
      status: 'waiting',
      max_players: 4,
      current_players: 0,
      expires_at: new Date(Date.now() - 5 * 60 * 1000),
      last_activity_at: new Date(Date.now() - 5 * 60 * 1000)
    });

    const sessions = await Session.findAll();

    expect(sessions).toHaveLength(1);
    expect(sessions[0].id).toBe(activeSession.id);
    expect(sessions[0].owner_user_id).toBe(owner.id);
  });

  it('counts only active non-expired sessions by owner', async () => {
    const owner = await createGuestUser({ name: 'Owner 2' });

    await Session.create({
      name: 'Waiting Active',
      owner_user_id: owner.id,
      status: 'waiting',
      max_players: 4,
      current_players: 0,
      expires_at: new Date(Date.now() + 30 * 60 * 1000),
      last_activity_at: new Date()
    });

    await Session.create({
      name: 'In Progress Active',
      owner_user_id: owner.id,
      status: 'in_progress',
      max_players: 4,
      current_players: 2,
      expires_at: new Date(Date.now() + 30 * 60 * 1000),
      last_activity_at: new Date()
    });

    await Session.create({
      name: 'Completed',
      owner_user_id: owner.id,
      status: 'completed',
      max_players: 4,
      current_players: 0,
      expires_at: new Date(Date.now() + 30 * 60 * 1000),
      last_activity_at: new Date()
    });

    await Session.create({
      name: 'Expired Waiting',
      owner_user_id: owner.id,
      status: 'waiting',
      max_players: 4,
      current_players: 0,
      expires_at: new Date(Date.now() - 5 * 60 * 1000),
      last_activity_at: new Date(Date.now() - 5 * 60 * 1000)
    });

    const activeCount = await Session.countActiveByOwner(owner.id);
    expect(activeCount).toBe(2);
  });

  it('deletes only expired empty sessions during cleanup', async () => {
    const owner = await createGuestUser({ name: 'Owner 3' });

    await Session.create({
      name: 'Expired Empty',
      owner_user_id: owner.id,
      status: 'waiting',
      max_players: 4,
      current_players: 0,
      expires_at: new Date(Date.now() - 5 * 60 * 1000),
      last_activity_at: new Date(Date.now() - 5 * 60 * 1000)
    });

    await Session.create({
      name: 'Expired Non Empty',
      owner_user_id: owner.id,
      status: 'in_progress',
      max_players: 4,
      current_players: 1,
      expires_at: new Date(Date.now() - 5 * 60 * 1000),
      last_activity_at: new Date(Date.now() - 5 * 60 * 1000)
    });

    await Session.create({
      name: 'Active Empty',
      owner_user_id: owner.id,
      status: 'waiting',
      max_players: 4,
      current_players: 0,
      expires_at: new Date(Date.now() + 30 * 60 * 1000),
      last_activity_at: new Date()
    });

    const deletedCount = await Session.deleteExpiredEmptySessions();
    expect(deletedCount).toBe(1);

    const remainingSessions = await db('sessions').select('name').orderBy('id', 'asc');
    const remainingNames = remainingSessions.map((session) => session.name);

    expect(remainingNames).toEqual(['Expired Non Empty', 'Active Empty']);
  });
});

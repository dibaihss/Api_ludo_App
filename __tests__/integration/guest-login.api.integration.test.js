const request = require('supertest');
const app = require('../../src/app');
const { db, truncateAllTables } = require('./dbTestUtils');

describe('Guest login API integration', () => {
  beforeAll(async () => {
    await db.migrate.latest();
  });

  beforeEach(async () => {
    await truncateAllTables();
  });

  afterAll(async () => {
    await db.destroy();
  });

  it('creates a guest user and returns JWT token', async () => {
    const response = await request(app)
      .post('/api/guest-login')
      .send({});

    expect(response.status).toBe(200);
    expect(response.body).toEqual(expect.objectContaining({
      id: expect.any(Number),
      name: expect.stringMatching(/^Guest_/),
      status: true,
      isGuest: true,
      token: expect.any(String)
    }));

    const createdUser = await db('users')
      .where({ id: response.body.id })
      .first();

    expect(createdUser).toBeTruthy();
    expect(createdUser.is_guest).toBe(true);
    expect(createdUser.email).toBeNull();
    expect(createdUser.password).toBeNull();
  });
});

const makeRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('usersController.guestLogin', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('returns a JWT token for guest users', async () => {
    jest.resetModules();
    jest.doMock('../src/models/User', () => ({
      create: jest.fn().mockResolvedValue({
        id: 10,
        name: 'Guest_abcd1234',
        status: true,
        is_guest: true,
        created_at: new Date('2026-04-07T00:00:00.000Z')
      })
    }));

    const sign = jest.fn().mockReturnValue('guest-jwt-token');
    jest.doMock('jsonwebtoken', () => ({ sign }));

    jest.doMock('../src/config/auth', () => ({
      jwtSecret: 'test-secret',
      jwtExpiresIn: '24h',
      jwtAlgorithm: 'HS256'
    }));

    // Require usersController only after all mocks are set up
    const usersController = require('../src/controllers/usersController');
    const req = {};
    const res = makeRes();

    await usersController.guestLogin(req, res);

    expect(sign).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      id: 10,
      isGuest: true,
      token: 'guest-jwt-token'
    }));
  });
});

const makeRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('sessionsController.createSession', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('blocks guest users after active session cap is reached', async () => {
    const Session = {
      countActiveByOwner: jest.fn().mockResolvedValue(1),
      create: jest.fn()
    };
    const User = {
      findById: jest.fn().mockResolvedValue({ id: 1, is_guest: true })
    };

    jest.doMock('../src/models/Session', () => Session);
    jest.doMock('../src/models/User', () => User);
    jest.doMock('../src/config/auth', () => ({
      sessionActiveCapGuest: 1,
      sessionActiveCapRegistered: 3,
      sessionTtlWaitingMinutes: 30,
      sessionTtlInProgressMinutes: 240
    }));

    const sessionsController = require('../src/controllers/sessionsController');

    const req = {
      body: { name: 'Room 1', status: 'waiting' },
      user: { userId: 1, isGuest: true }
    };
    const res = makeRes();

    await sessionsController.createSession(req, res);

    expect(User.findById).toHaveBeenCalledWith(1);
    expect(Session.countActiveByOwner).toHaveBeenCalledWith(1);
    expect(Session.create).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(429);
  });

  it('blocks registered users after active session cap is reached', async () => {
    const Session = {
      countActiveByOwner: jest.fn().mockResolvedValue(3),
      create: jest.fn()
    };
    const User = {
      findById: jest.fn().mockResolvedValue({ id: 99, is_guest: false })
    };

    jest.doMock('../src/models/Session', () => Session);
    jest.doMock('../src/models/User', () => User);
    jest.doMock('../src/config/auth', () => ({
      sessionActiveCapGuest: 1,
      sessionActiveCapRegistered: 3,
      sessionTtlWaitingMinutes: 30,
      sessionTtlInProgressMinutes: 240
    }));

    const sessionsController = require('../src/controllers/sessionsController');

    const req = {
      body: { name: 'Room 2', status: 'waiting' },
      user: { userId: 99, isGuest: false }
    };
    const res = makeRes();

    await sessionsController.createSession(req, res);

    expect(User.findById).toHaveBeenCalledWith(99);
    expect(Session.countActiveByOwner).toHaveBeenCalledWith(99);
    expect(Session.create).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(429);
  });

  it('rejects invalid status values', async () => {
    const Session = {
      countActiveByOwner: jest.fn(),
      create: jest.fn()
    };
    const User = {
      findById: jest.fn()
    };

    jest.doMock('../src/models/Session', () => Session);
    jest.doMock('../src/models/User', () => User);
    jest.doMock('../src/config/auth', () => ({
      sessionActiveCapGuest: 1,
      sessionActiveCapRegistered: 3,
      sessionTtlWaitingMinutes: 30,
      sessionTtlInProgressMinutes: 240
    }));

    const sessionsController = require('../src/controllers/sessionsController');

    const req = {
      body: { name: 'Room 3', status: 'invalid_status' },
      user: { userId: 5, isGuest: false }
    };
    const res = makeRes();

    await sessionsController.createSession(req, res);

    expect(Session.countActiveByOwner).not.toHaveBeenCalled();
    expect(Session.create).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'Invalid status value' });
  });

  it('returns user not found when the owner no longer exists', async () => {
    const Session = {
      countActiveByOwner: jest.fn(),
      create: jest.fn()
    };
    const User = {
      findById: jest.fn().mockResolvedValue(undefined)
    };

    jest.doMock('../src/models/Session', () => Session);
    jest.doMock('../src/models/User', () => User);
    jest.doMock('../src/config/auth', () => ({
      sessionActiveCapGuest: 1,
      sessionActiveCapRegistered: 3,
      sessionTtlWaitingMinutes: 30,
      sessionTtlInProgressMinutes: 240
    }));

    const sessionsController = require('../src/controllers/sessionsController');

    const req = {
      body: { name: 'Room Missing Owner', status: 'waiting' },
      user: { userId: 404, isGuest: true }
    };
    const res = makeRes();

    await sessionsController.createSession(req, res);

    expect(User.findById).toHaveBeenCalledWith(404);
    expect(Session.countActiveByOwner).not.toHaveBeenCalled();
    expect(Session.create).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'User not found' });
  });

  it('creates a session successfully and includes ownership + lifecycle fields', async () => {
  const Session = {
    countActiveByOwner: jest.fn().mockResolvedValue(0),
    create: jest.fn().mockResolvedValue({
      id: 123,
      name: 'Room Alpha',
      status: 'waiting',
      max_players: 4,
      current_players: 0,
      created_at: new Date('2026-04-07T10:00:00.000Z'),
      updated_at: new Date('2026-04-07T10:00:00.000Z')
    })
  };
  const User = {
    findById: jest.fn().mockResolvedValue({ id: 42, is_guest: false })
  };

  jest.doMock('../src/models/Session', () => Session);
  jest.doMock('../src/models/User', () => User);
  jest.doMock('../src/config/auth', () => ({
    sessionActiveCapGuest: 1,
    sessionActiveCapRegistered: 3,
    sessionTtlWaitingMinutes: 30,
    sessionTtlInProgressMinutes: 240
  }));

  const sessionsController = require('../src/controllers/sessionsController');

  const req = {
    body: { name: 'Room Alpha', status: 'waiting', maxPlayers: 4 },
    user: { userId: 42, isGuest: false }
  };
  const res = makeRes();

  await sessionsController.createSession(req, res);

  expect(User.findById).toHaveBeenCalledWith(42);
  expect(Session.countActiveByOwner).toHaveBeenCalledWith(42);
  expect(Session.create).toHaveBeenCalledWith(expect.objectContaining({
    name: 'Room Alpha',
    owner_user_id: 42,
    status: 'waiting',
    max_players: 4,
    current_players: 0,
    expires_at: expect.any(Date),
    last_activity_at: expect.any(Date)
  }));
  expect(res.status).toHaveBeenCalledWith(201);
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
    id: 123,
    name: 'Room Alpha',
    status: 'waiting',
    maxPlayers: 4,
    currentPlayers: 0
  }));
});

});

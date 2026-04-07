const makeRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('sessionCreateRateLimiter', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('returns 429 when per-user session creation limit is exceeded', () => {
    jest.doMock('../src/config/auth', () => ({
      sessionCreateWindowMs: 600000,
      sessionCreateMaxPerUser: 2,
      sessionCreateMaxPerIp: 100
    }));

    const limiter = require('../src/middleware/sessionCreateRateLimiter');

    const req = {
      user: { userId: 7 },
      ip: '127.0.0.1',
      connection: { remoteAddress: '127.0.0.1' }
    };

    const res = makeRes();
    const next = jest.fn();

    limiter(req, res, next);
    limiter(req, res, next);
    limiter(req, res, next);

    expect(next).toHaveBeenCalledTimes(2);
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Too many session creation attempts. Please try again later.'
    });
  });
});

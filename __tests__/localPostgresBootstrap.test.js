describe('localPostgresBootstrap', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('does not prompt when the configured database is already reachable', async () => {
    const bootstrap = require('../src/startup/localPostgresBootstrap');
    const probeDatabaseConnectionImpl = jest.fn().mockResolvedValue({ ok: true });
    const promptToUseLocalDockerPostgresImpl = jest.fn();

    const result = await bootstrap.ensureDatabaseReady({
      env: {},
      streams: {
        stdin: { isTTY: true },
        stdout: { isTTY: true }
      },
      probeDatabaseConnectionImpl,
      promptToUseLocalDockerPostgresImpl
    });

    expect(result).toEqual({
      usingLocalDockerPostgres: false,
      shutdownLocalPostgres: null
    });
    expect(promptToUseLocalDockerPostgresImpl).not.toHaveBeenCalled();
  });

  it('keeps current behavior in non-interactive environments', async () => {
    const bootstrap = require('../src/startup/localPostgresBootstrap');
    const connectionError = new Error('connect ECONNREFUSED');
    const probeDatabaseConnectionImpl = jest.fn().mockResolvedValue({
      ok: false,
      error: connectionError
    });

    await expect(bootstrap.ensureDatabaseReady({
      env: {
        NODE_ENV: 'development',
        CI: 'true'
      },
      streams: {
        stdin: { isTTY: false },
        stdout: { isTTY: false }
      },
      probeDatabaseConnectionImpl
    })).rejects.toBe(connectionError);
  });

  it('exits cleanly when the user declines the Docker fallback', async () => {
    const bootstrap = require('../src/startup/localPostgresBootstrap');
    const probeDatabaseConnectionImpl = jest.fn().mockResolvedValue({
      ok: false,
      error: new Error('connect ECONNREFUSED')
    });
    const promptToUseLocalDockerPostgresImpl = jest.fn().mockResolvedValue(false);

    await expect(bootstrap.ensureDatabaseReady({
      env: {
        NODE_ENV: 'development'
      },
      streams: {
        stdin: { isTTY: true },
        stdout: { isTTY: true }
      },
      probeDatabaseConnectionImpl,
      promptToUseLocalDockerPostgresImpl,
      logger: {
        warn: jest.fn(),
        log: jest.fn(),
        error: jest.fn()
      }
    })).rejects.toThrow('Server start cancelled because PostgreSQL is not reachable.');
  });

  it('starts Docker Postgres, runs migrations, and updates env for this process when accepted', async () => {
    const bootstrap = require('../src/startup/localPostgresBootstrap');
    const env = {
      NODE_ENV: 'development',
      DB_HOST: 'remote-host',
      DB_PORT: '5432'
    };
    const probeDatabaseConnectionImpl = jest.fn()
      .mockResolvedValueOnce({
        ok: false,
        error: new Error('connect ECONNREFUSED')
      })
      .mockResolvedValueOnce({ ok: true });
    const promptToUseLocalDockerPostgresImpl = jest.fn().mockResolvedValue(true);
    const startLocalDockerPostgresImpl = jest.fn().mockResolvedValue(undefined);
    const runLocalMigrationsImpl = jest.fn().mockResolvedValue(undefined);
    const stopLocalDockerPostgresImpl = jest.fn().mockResolvedValue(undefined);

    const result = await bootstrap.ensureDatabaseReady({
      env,
      streams: {
        stdin: { isTTY: true },
        stdout: { isTTY: true }
      },
      logger: {
        warn: jest.fn(),
        log: jest.fn(),
        error: jest.fn()
      },
      probeDatabaseConnectionImpl,
      promptToUseLocalDockerPostgresImpl,
      startLocalDockerPostgresImpl,
      runLocalMigrationsImpl,
      stopLocalDockerPostgresImpl
    });

    expect(env).toMatchObject({
      DATABASE_URL: 'disabled',
      DB_HOST: '127.0.0.1',
      DB_PORT: '5434',
      DB_NAME: 'ludo_local',
      DB_USER: 'postgres',
      DB_PASSWORD: 'postgres',
      DB_SSL: 'false'
    });
    expect(startLocalDockerPostgresImpl).toHaveBeenCalledTimes(1);
    expect(runLocalMigrationsImpl).toHaveBeenCalledTimes(1);
    expect(result.usingLocalDockerPostgres).toBe(true);

    await result.shutdownLocalPostgres();
    await result.shutdownLocalPostgres();

    expect(stopLocalDockerPostgresImpl).toHaveBeenCalledTimes(1);
  });

  it('detects interactive local sessions correctly', () => {
    const bootstrap = require('../src/startup/localPostgresBootstrap');

    expect(bootstrap.isInteractiveLocalRuntime(
      { NODE_ENV: 'development' },
      { stdin: { isTTY: true }, stdout: { isTTY: true } }
    )).toBe(true);

    expect(bootstrap.isInteractiveLocalRuntime(
      { NODE_ENV: 'production' },
      { stdin: { isTTY: true }, stdout: { isTTY: true } }
    )).toBe(false);
  });

  it('formats aggregate connection errors with nested messages', () => {
    const bootstrap = require('../src/startup/localPostgresBootstrap');

    const error = new AggregateError([
      new Error('connect ECONNREFUSED ::1:5433'),
      new Error('connect ECONNREFUSED 127.0.0.1:5433')
    ]);
    error.code = 'ECONNREFUSED';

    expect(bootstrap.formatErrorMessage(error)).toBe(
      'connect ECONNREFUSED ::1:5433; connect ECONNREFUSED 127.0.0.1:5433'
    );
  });

  it('wraps Windows cmd scripts through cmd.exe for spawn safety', () => {
    jest.resetModules();
    const originalPlatform = process.platform;
    const originalComSpec = process.env.comspec;

    Object.defineProperty(process, 'platform', {
      value: 'win32'
    });
    process.env.comspec = 'C:\\Windows\\System32\\cmd.exe';

    const bootstrap = require('../src/startup/localPostgresBootstrap');

    expect(bootstrap.getSpawnCommand('npm.cmd', ['run', 'migrate'])).toEqual({
      command: 'C:\\Windows\\System32\\cmd.exe',
      args: ['/d', '/s', '/c', 'npm.cmd', 'run', 'migrate'],
      options: {
        windowsVerbatimArguments: true
      }
    });

    if (originalComSpec === undefined) {
      delete process.env.comspec;
    } else {
      process.env.comspec = originalComSpec;
    }

    Object.defineProperty(process, 'platform', {
      value: originalPlatform
    });
  });
});

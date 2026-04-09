const path = require('node:path');
const { spawn } = require('node:child_process');
const readline = require('node:readline/promises');
const { createKnex } = require('../config/database-factory');

const LOCAL_COMPOSE_FILE = path.resolve(__dirname, '..', '..', 'docker-compose.local.yml');
const LOCAL_CONTAINER_NAME = 'ludo-postgres-local';
const LOCAL_DOCKER_DB_ENV = Object.freeze({
  DATABASE_URL: 'disabled',
  DB_HOST: '127.0.0.1',
  DB_PORT: '5434',
  DB_NAME: 'ludo_local',
  DB_USER: 'postgres',
  DB_PASSWORD: 'postgres',
  DB_SSL: 'false'
});

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const formatErrorMessage = (error) => {
  if (!error) {
    return 'Unknown error';
  }

  if (typeof error.message === 'string' && error.message.trim()) {
    return error.message;
  }

  if (Array.isArray(error.errors) && error.errors.length > 0) {
    return error.errors
      .map((nestedError) => nestedError && nestedError.message)
      .filter(Boolean)
      .join('; ');
  }

  if (error.code) {
    return String(error.code);
  }

  return String(error);
};

const isInteractiveLocalRuntime = (
  env = process.env,
  streams = { stdin: process.stdin, stdout: process.stdout }
) => (
  env.NODE_ENV !== 'production'
  && env.CI !== 'true'
  && Boolean(streams.stdin && streams.stdin.isTTY)
  && Boolean(streams.stdout && streams.stdout.isTTY)
);

const applyLocalDockerDbEnv = (env = process.env) => {
  Object.assign(env, LOCAL_DOCKER_DB_ENV);
  return env;
};

const getSpawnCommand = (command, args) => {
  if (process.platform !== 'win32') {
    return {
      command,
      args,
      options: {}
    };
  }

  const isWindowsScript = /\.(cmd|bat)$/i.test(command);

  if (!isWindowsScript) {
    return {
      command,
      args,
      options: {}
    };
  }

  return {
    command: process.env.comspec || 'cmd.exe',
    args: ['/d', '/s', '/c', command, ...args],
    options: {
      windowsVerbatimArguments: true
    }
  };
};

const runCommand = (command, args, { env = process.env, stdio = 'pipe' } = {}) => new Promise((resolve, reject) => {
  const spawnCommand = getSpawnCommand(command, args);
  const child = spawn(spawnCommand.command, spawnCommand.args, {
    env,
    stdio,
    ...spawnCommand.options
  });
  let stdout = '';
  let stderr = '';

  if (child.stdout) {
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
  }

  if (child.stderr) {
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
  }

  child.on('error', reject);
  child.on('close', (code) => {
    if (code === 0) {
      resolve({ stdout, stderr });
      return;
    }

    const renderedCommand = [command, ...args].join(' ');
    reject(new Error(`Command failed (${code}): ${renderedCommand}${stderr ? `\n${stderr.trim()}` : ''}`));
  });
});

const promptToUseLocalDockerPostgres = async ({
  input = process.stdin,
  output = process.stdout,
  createInterface = readline.createInterface
} = {}) => {
  const rl = createInterface({ input, output });

  try {
    while (true) {
      const answer = (await rl.question(
        'PostgreSQL is not reachable. Start a disposable local Docker PostgreSQL container for this run? (y/N) '
      )).trim().toLowerCase();

      if (!answer || answer === 'n' || answer === 'no') {
        return false;
      }

      if (answer === 'y' || answer === 'yes') {
        return true;
      }

      output.write('Please answer yes or no.\n');
    }
  } finally {
    rl.close();
  }
};

const probeDatabaseConnection = async ({ env = process.env } = {}) => {
  const db = createKnex(env, {
    pool: {
      min: 0,
      max: 1
    }
  });

  try {
    await db.raw('select 1');
    return { ok: true };
  } catch (error) {
    return { ok: false, error };
  } finally {
    await db.destroy();
  }
};

const waitForLocalPostgres = async ({
  env = process.env,
  runCommandImpl = runCommand,
  attempts = 30,
  delayMs = 2000
} = {}) => {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const { stdout } = await runCommandImpl(
        'docker',
        ['inspect', '-f', '{{.State.Health.Status}}', LOCAL_CONTAINER_NAME],
        { env }
      );

      if (stdout.trim() === 'healthy') {
        return;
      }
    } catch (error) {
      // Keep polling while the container is still starting up.
    }

    await delay(delayMs);
  }

  throw new Error('Local PostgreSQL Docker container did not become healthy in time.');
};

const startLocalDockerPostgres = async ({
  env = process.env,
  logger = console,
  runCommandImpl = runCommand
} = {}) => {
  logger.log('Starting disposable local PostgreSQL container...');
  await runCommandImpl(
    'docker',
    ['compose', '-f', LOCAL_COMPOSE_FILE, 'up', '-d'],
    { env, stdio: 'inherit' }
  );
  await waitForLocalPostgres({ env, runCommandImpl });
};

const stopLocalDockerPostgres = async ({
  env = process.env,
  logger = console,
  runCommandImpl = runCommand
} = {}) => {
  logger.log('Stopping disposable local PostgreSQL container...');
  await runCommandImpl(
    'docker',
    ['compose', '-f', LOCAL_COMPOSE_FILE, 'down', '-v'],
    { env, stdio: 'inherit' }
  );
};

const runLocalMigrations = async ({
  env = process.env,
  logger = console,
  runCommandImpl = runCommand
} = {}) => {
  logger.log('Running database migrations against local Docker PostgreSQL...');
  await runCommandImpl(
    process.platform === 'win32' ? 'npm.cmd' : 'npm',
    ['run', 'migrate'],
    { env, stdio: 'inherit' }
  );
};

const ensureDatabaseReady = async ({
  env = process.env,
  streams = { stdin: process.stdin, stdout: process.stdout },
  logger = console,
  probeDatabaseConnectionImpl = probeDatabaseConnection,
  promptToUseLocalDockerPostgresImpl = promptToUseLocalDockerPostgres,
  startLocalDockerPostgresImpl = startLocalDockerPostgres,
  stopLocalDockerPostgresImpl = stopLocalDockerPostgres,
  runLocalMigrationsImpl = runLocalMigrations
} = {}) => {
  const probe = await probeDatabaseConnectionImpl({ env });

  if (probe.ok) {
    return {
      usingLocalDockerPostgres: false,
      shutdownLocalPostgres: null
    };
  }

  if (!isInteractiveLocalRuntime(env, streams)) {
    throw probe.error;
  }

  logger.warn(`Database connection failed: ${formatErrorMessage(probe.error)}`);
  const shouldUseLocalDockerPostgres = await promptToUseLocalDockerPostgresImpl({
    input: streams.stdin,
    output: streams.stdout
  });

  if (!shouldUseLocalDockerPostgres) {
    throw new Error('Server start cancelled because PostgreSQL is not reachable.');
  }

  applyLocalDockerDbEnv(env);

  try {
    await startLocalDockerPostgresImpl({ env, logger });
    await runLocalMigrationsImpl({ env, logger });
  } catch (error) {
    try {
      await stopLocalDockerPostgresImpl({ env, logger });
    } catch (cleanupError) {
      logger.error('Failed to clean up local PostgreSQL container after startup error:', cleanupError.message);
    }
    throw error;
  }

  const localProbe = await probeDatabaseConnectionImpl({ env });

  if (!localProbe.ok) {
    try {
      await stopLocalDockerPostgresImpl({ env, logger });
    } catch (cleanupError) {
      logger.error('Failed to clean up local PostgreSQL container after connectivity check:', cleanupError.message);
    }

    throw new Error(`Local PostgreSQL started, but the app still could not connect: ${formatErrorMessage(localProbe.error)}`);
  }

  let didShutdown = false;
  return {
    usingLocalDockerPostgres: true,
    shutdownLocalPostgres: async () => {
      if (didShutdown) {
        return;
      }

      didShutdown = true;
      await stopLocalDockerPostgresImpl({ env, logger });
    }
  };
};

module.exports = {
  LOCAL_COMPOSE_FILE,
  LOCAL_CONTAINER_NAME,
  LOCAL_DOCKER_DB_ENV,
  applyLocalDockerDbEnv,
  ensureDatabaseReady,
  formatErrorMessage,
  getSpawnCommand,
  isInteractiveLocalRuntime,
  probeDatabaseConnection,
  promptToUseLocalDockerPostgres,
  runCommand,
  runLocalMigrations,
  startLocalDockerPostgres,
  stopLocalDockerPostgres,
  waitForLocalPostgres
};

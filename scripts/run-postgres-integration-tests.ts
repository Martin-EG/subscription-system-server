import { spawnSync } from 'node:child_process';

const databaseUrl =
  process.env.TEST_DATABASE_URL ??
  'postgresql://subscription:subscription@127.0.0.1:55432/subscription_integration';
const composeArgs = [
  'compose',
  '-p',
  'subscription-system-integration',
  '-f',
  'compose.integration.yaml',
];
const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';

function run(command: string, args: string[], env: NodeJS.ProcessEnv = process.env): void {
  const result = spawnSync(command, args, {
    env,
    stdio: 'inherit',
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with code ${result.status}`);
  }
}

let databaseStarted = false;

try {
  run('docker', [...composeArgs, 'up', '-d', '--wait']);
  databaseStarted = true;

  run(npxCommand, ['prisma', 'db', 'push', '--skip-generate', '--accept-data-loss'], {
    ...process.env,
    DIRECT_URL: databaseUrl,
  });

  run(npxCommand, ['jest', '--config', 'jest.integration.config.ts', '--runInBand'], {
    ...process.env,
    TEST_DATABASE_URL: databaseUrl,
  });
} finally {
  if (databaseStarted) {
    run('docker', [...composeArgs, 'down', '--volumes']);
  }
}

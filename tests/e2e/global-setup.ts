import { execFileSync } from 'node:child_process';

/** A fresh run starts with a clean throttle table: the suite deliberately fails sign-ins, and counters outlive runs. */
export default function globalSetup() {
  execFileSync('npx', ['wrangler', 'd1', 'execute', 'pacf-records', '--local', '--command', 'DELETE FROM verify_attempts'], {
    stdio: 'pipe',
    env: { ...process.env, WRANGLER_SEND_METRICS: 'false' },
  });
}

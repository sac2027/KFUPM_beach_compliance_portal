import { existsSync } from 'node:fs';
import { defineConfig } from '@playwright/test';

// Use a specific Chromium when one is provided (PW_CHROMIUM_PATH) or preinstalled in the build sandbox;
// anywhere else (a laptop, CI) Playwright's own browser from `npx playwright install chromium` is used.
const SANDBOX_CHROMIUM = '/opt/pw-browsers/chromium';
const executablePath = process.env.PW_CHROMIUM_PATH ?? (existsSync(SANDBOX_CHROMIUM) ? SANDBOX_CHROMIUM : undefined);
const launchOptions = { ...(executablePath ? { executablePath } : {}), args: ['--no-sandbox'] };
const PROD = 'http://127.0.0.1:8788'; // the production build served by the local Pages dev server, with the API and local D1/R2
const DEV = 'http://127.0.0.1:5174'; // the dev server: has the worst-case toggle (break-ui)

const sizes = [
  { name: '1280', viewport: { width: 1280, height: 800 }, hasTouch: false },
  { name: '360', viewport: { width: 360, height: 740 }, hasTouch: true },
  { name: '320', viewport: { width: 320, height: 640 }, hasTouch: true },
] as const;

export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  fullyParallel: true,
  reporter: [['list']],
  use: { launchOptions, trace: 'retain-on-failure' },
  webServer: [
    {
      command: 'npm run serve:test',
      url: `${PROD}/api/health`,
      reuseExistingServer: true,
      timeout: 180_000,
      env: { WRANGLER_SEND_METRICS: 'false', NO_PROXY: '*', no_proxy: '*' },
    },
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 5174 --strictPort',
      url: DEV,
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
  projects: [
    ...sizes.map((s) => ({
      name: s.name === '1280' ? 'desktop-1280' : s.name === '360' ? 'mobile-360' : 'small-320',
      testIgnore: /worst-case/,
      use: { baseURL: PROD, viewport: s.viewport, hasTouch: s.hasTouch },
    })),
    ...sizes.map((s) => ({
      name: `worst-${s.name}`,
      testMatch: /worst-case/,
      use: { baseURL: DEV, viewport: s.viewport, hasTouch: s.hasTouch },
    })),
  ],
});

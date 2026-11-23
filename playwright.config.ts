// End-to-end check of OpenFields through a real merchant integration (this app's checkout + backend).
//   npm test                     -> CARDCOM_ENV or billgold
//   npm test -- --env=local      (handled by scripts/test.mjs)
// The dev servers are started for the run (or reused when already running on the same ports).
import { defineConfig, devices } from '@playwright/test';
import { loadEnvironment } from './scripts/env.mjs';

const env = loadEnvironment(process.env.CARDCOM_ENV);

export default defineConfig({
  testDir: './e2e',
  timeout: 120_000,
  fullyParallel: false,
  // One payment at a time: every test charges the environment's terminal and then refunds.
  workers: 1,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: env.frontendUrl,
    // The checkout runs on Vite's self-signed certificate; CardCom's internal hosts use the company CA.
    ignoreHTTPSErrors: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'Desktop Chrome', use: { ...devices['Desktop Chrome'] } },
    { name: 'iPhone (WebKit)', use: { ...devices['iPhone 13'] } },
    { name: 'Android (Pixel 7)', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: `node scripts/dev.mjs --env=${env.name}`,
    url: `${env.serverUrl}/health`,
    reuseExistingServer: true,
    timeout: 60_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});

import { config as dotenv } from 'dotenv';
import { defineConfig, devices } from '@playwright/test';
import { resolve } from 'path';

dotenv({ path: resolve(__dirname, '.env.e2e') });

const isCI = !!process.env.CI;

const dbUrl =
  process.env.DATABASE_URL ??
  'postgresql://nossagrana_e2e:nossagrana_e2e@localhost:5433/nossagrana_e2e';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  retries: isCI ? 2 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  globalSetup: './global-setup.ts',
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:5173',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    serviceWorkers: 'block',
  },
  webServer: [
    {
      command: `DATABASE_URL=${dbUrl} NODE_ENV=development JWT_SECRET=e2e-secret REFRESH_TOKEN_SECRET=e2e-refresh JWT_EXPIRES_IN=15m REFRESH_TOKEN_EXPIRES_IN=7d CORS_ORIGIN=http://localhost:5173 PORT=3000 pnpm --filter api dev`,
      url: 'http://localhost:3000/api/health',
      reuseExistingServer: true,
      stdout: 'pipe',
      stderr: 'pipe',
      timeout: 60_000,
    },
    {
      command: 'pnpm --filter web dev',
      url: 'http://localhost:5173',
      reuseExistingServer: true,
      timeout: 60_000,
    },
  ],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});

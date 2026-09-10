import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'tests/browser',
  timeout: 60000,
  use: {
    baseURL: process.env.E2E_URL || 'http://localhost:5173',
    headless: true,
    channel: process.env.E2E_BROWSER || 'chrome',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  reporter: 'list',
  workers: 1,
});

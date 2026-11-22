import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e', timeout: 45000, expect: { timeout: 12000 }, fullyParallel: false, workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: process.env['CHUBB_E2E_BASE_URL'] ?? 'http://localhost:4200', channel: process.env['CHUBB_BROWSER_CHANNEL'] ?? 'chrome', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 1000 } } }
  ]
});

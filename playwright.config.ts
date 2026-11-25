import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  outputDir: './qa-output/playwright',
  timeout: 45_000,
  expect: { timeout: 12_000 },
  workers: 1,
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'webkit', use: { browserName: 'webkit' } },
  ],
  use: {
    baseURL: 'http://127.0.0.1:4174/piano-practice/',
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run preview -- --host 127.0.0.1 --port 4174 --strictPort',
    url: 'http://127.0.0.1:4174/piano-practice/',
    timeout: 30_000,
    reuseExistingServer: false,
  },
});

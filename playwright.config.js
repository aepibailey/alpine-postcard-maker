import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}/alpine-postcard-maker/`,
    ...devices['Pixel 7'],
    viewport: { width: 412, height: 915 },
    serviceWorkers: 'allow',
  },
  projects: [{ name: 'phone-chromium', use: { browserName: 'chromium' } }],
  webServer: {
    command: `node scripts/serve.mjs`,
    env: { PORT: String(PORT) },
    url: `http://localhost:${PORT}/alpine-postcard-maker/`,
    reuseExistingServer: !process.env.CI,
  },
});

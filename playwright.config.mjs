import { defineConfig, devices } from '@playwright/test';

// Tunnel d'estimation testé de bout en bout avec l'API simulée (pas de MongoDB ni de SMS)
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  use: { baseURL: 'http://localhost:3100' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 900 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'node .next/standalone/server.js',
    port: 3100,
    env: { PORT: '3100', HOSTNAME: '127.0.0.1' },
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});

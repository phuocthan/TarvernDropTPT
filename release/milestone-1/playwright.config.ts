import { defineConfig } from '@playwright/test';
export default defineConfig({
 testDir: './tests/browser', workers: 1, timeout: 45000,
 use: { baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:4352', headless: true,
  launchOptions: { executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }, screenshot: 'only-on-failure' },
 webServer: process.env.PLAYWRIGHT_BASE_URL ? undefined : {
  command: 'npm run build && npm start', url: 'http://127.0.0.1:4352',
  env: { PORT: '4352', MOCK_API_DATA_FILE: '.runtime/m1-browser.json' }, reuseExistingServer: false, timeout: 120000,
 },
});

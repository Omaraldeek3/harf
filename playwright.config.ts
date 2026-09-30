import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir:'./tests',testMatch:'**/*.spec.ts',fullyParallel:false,
  reporter:'list',use:{baseURL:'http://127.0.0.1:5190',trace:'retain-on-failure'},
  webServer:{command:'npm run dev -- --port 5190 --strictPort',url:'http://127.0.0.1:5190',reuseExistingServer:!process.env.CI},
  projects:[{name:'chromium',use:{...devices['Desktop Chrome'],channel:process.env.PLAYWRIGHT_CHANNEL||undefined}}],
});

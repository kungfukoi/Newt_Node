import { defineConfig } from "@playwright/test";
const port = Number(process.env.NEWTNODE_E2E_PORT || 5286);
export default defineConfig({
  testDir: "./e2e", testMatch: "**/*.spec.js", globalSetup: "./e2e/setup.mjs", workers: 1,
  timeout: 90000, expect: { timeout: 15000 }, retries: process.env.CI ? 1 : 0,
  use: { baseURL: `http://127.0.0.1:${port}`, viewport: { width: 1600, height: 1100 }, browserName: "chromium", trace: "retain-on-failure", screenshot: "only-on-failure", serviceWorkers: "block" },
  webServer: { command: `npm run preview -- --port ${port} --strictPort`, url: `http://127.0.0.1:${port}`, reuseExistingServer: false, timeout: 60000 },
  reporter: [["list"], ["html", { open: "never" }]]
});

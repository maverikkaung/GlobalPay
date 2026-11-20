import { defineConfig, devices } from "@playwright/test";
import process from "node:process";
import { tmpdir } from "node:os";
import path from "node:path";

const externalBaseURL = process.env.PLAYWRIGHT_BASE_URL;
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
  || (process.platform === "win32" ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" : undefined);

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.js",
  outputDir: path.join(tmpdir(), `techkarvo-playwright-${process.pid}`),
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "list",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    ...devices["Desktop Chrome"],
    baseURL: externalBaseURL || "http://127.0.0.1:5173",
    actionTimeout: 15_000,
    navigationTimeout: 60_000,
    launchOptions: executablePath ? { executablePath } : {},
    trace: "off"
  },
  // `npm run test:e2e` owns the local Vite process so Windows can shut it down
  // reliably without Playwright's shell-based webServer process-tree cleanup.
  webServer: undefined
});

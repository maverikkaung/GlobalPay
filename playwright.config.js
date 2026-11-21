import { defineConfig, devices } from "@playwright/test";
import process from "node:process";
import { tmpdir } from "node:os";
import path from "node:path";
import { QA_CHROME_ARGS } from "./scripts/staging-qa-session.js";

const externalBaseURL = process.env.PLAYWRIGHT_BASE_URL;
const localBase = !externalBaseURL || new URL(externalBaseURL).hostname === "127.0.0.1";
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
  || (process.platform === "win32" ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" : undefined);

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.js",
  testIgnore: localBase ? undefined : "**/isolated/**",
  outputDir: path.join(tmpdir(), `techkarvo-playwright-${process.pid}`),
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  // Staging E2E uses two dedicated accounts with shared persistent records.
  // Serialize the suite so parallel cases cannot race on connections, jobs, or wallets.
  workers: process.env.CI || externalBaseURL ? 1 : undefined,
  reporter: "list",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    ...devices["Desktop Chrome"],
    baseURL: externalBaseURL || "http://127.0.0.1:5173",
    actionTimeout: 15_000,
    navigationTimeout: 60_000,
    launchOptions: executablePath ? { executablePath, args: QA_CHROME_ARGS } : { args: QA_CHROME_ARGS },
    trace: "off"
  },
  // `npm run test:e2e` owns the local Vite process so Windows can shut it down
  // reliably without Playwright's shell-based webServer process-tree cleanup.
  webServer: undefined
});

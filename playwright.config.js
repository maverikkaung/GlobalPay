import { defineConfig, devices } from "@playwright/test";
import process from "node:process";

const externalBaseURL = process.env.PLAYWRIGHT_BASE_URL;
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
  || (process.platform === "win32" ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" : undefined);

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.js",
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
    launchOptions: executablePath ? { executablePath } : {},
    trace: "retain-on-failure"
  },
  webServer: externalBaseURL ? undefined : {
    command: "npm run dev -- --host 127.0.0.1",
    url: "http://127.0.0.1:5173/demo",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: {
      VITE_SUPABASE_URL: "https://e2e-placeholder.invalid",
      VITE_SUPABASE_ANON_KEY: "e2e-placeholder-public-key"
    }
  }
});

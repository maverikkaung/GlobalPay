import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import process from "node:process";

const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:5173";
const localRun = !process.env.PLAYWRIGHT_BASE_URL;
const vitePath = fileURLToPath(new URL("../node_modules/vite/bin/vite.js", import.meta.url));
const playwrightPath = fileURLToPath(new URL("../node_modules/@playwright/test/cli.js", import.meta.url));
let vite;

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", windowsHide: true, ...options });
    child.once("error", reject);
    child.once("close", (code, signal) => resolve({ code: code ?? (signal ? 1 : 0), child }));
  });
}

async function waitForVite() {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (vite.exitCode !== null) throw new Error("Vite exited before becoming ready.");
    try {
      const response = await fetch(`${baseURL}/demo`, { signal: AbortSignal.timeout(1_500) });
      if (response.ok) return;
    } catch {
      // The local server is still starting.
    }
    await delay(200);
  }
  throw new Error("Vite did not become ready within 60 seconds.");
}

async function stopVite() {
  if (!vite || vite.exitCode !== null) return;
  vite.kill("SIGTERM");
  await new Promise((resolve) => {
    const timer = setTimeout(() => {
      if (vite.exitCode === null) vite.kill("SIGKILL");
      resolve();
    }, 5_000);
    vite.once("close", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

try {
  if (localRun) {
    process.env.PLAYWRIGHT_BASE_URL = baseURL;
    vite = spawn(process.execPath, [vitePath, "--host", "127.0.0.1"], {
      stdio: "inherit",
      windowsHide: true,
      env: {
        ...process.env,
        VITE_SUPABASE_URL: "https://e2e-placeholder.invalid",
        VITE_SUPABASE_ANON_KEY: "e2e-placeholder-public-key"
      }
    });
    vite.once("error", (error) => process.emitWarning(error));
    await waitForVite();
  }

  const result = await run(process.execPath, [playwrightPath, "test", ...process.argv.slice(2)], {
    env: { ...process.env, PLAYWRIGHT_BASE_URL: baseURL }
  });
  process.exitCode = result.code;
} catch (error) {
  process.stderr.write(`Playwright setup failed: ${error.message}\n`);
  process.exitCode = 1;
} finally {
  await stopVite();
}

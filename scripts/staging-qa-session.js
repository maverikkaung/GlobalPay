import { setTimeout as delay } from "node:timers/promises";

export const QA_LOGIN_NAVIGATION_ATTEMPTS = 3;

export function isTransientLoginNavigationError(error) {
  return error?.name === "TimeoutError"
    || /net::ERR_(?:ABORTED|CONNECTION_RESET|CONNECTION_CLOSED|CONNECTION_TIMED_OUT|NAME_NOT_RESOLVED|INTERNET_DISCONNECTED)|ECONNRESET|Transient staging response (?:429|5\d\d)/i.test(String(error?.message || ""));
}

/** Navigate to staging login with bounded retries, then verify the form is usable. */
export async function navigateToStagingLogin(page, url, options = {}) {
  const attempts = options.attempts ?? QA_LOGIN_NAVIGATION_ATTEMPTS;
  const navigationTimeoutMs = options.navigationTimeoutMs ?? 20_000;
  const formTimeoutMs = options.formTimeoutMs ?? 10_000;
  const wait = options.wait ?? delay;
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: navigationTimeoutMs });
      if (response && (response.status() === 429 || response.status() >= 500)) {
        throw new Error(`Transient staging response ${response.status()}`);
      }
      await page.locator("#login-email").waitFor({ state: "visible", timeout: formTimeoutMs });
      await page.locator("#login-password").waitFor({ state: "visible", timeout: formTimeoutMs });
      await page.getByRole("button", { name: "Login", exact: true }).waitFor({ state: "visible", timeout: formTimeoutMs });
      return;
    } catch (error) {
      lastError = error;
      if (!isTransientLoginNavigationError(error) || attempt === attempts) throw error;
      await wait(500 * attempt);
    }
  }

  throw lastError || new Error("The staging login form could not be prepared.");
}

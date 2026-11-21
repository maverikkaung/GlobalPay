import { setTimeout as delay } from "node:timers/promises";

export const QA_LOGIN_NAVIGATION_ATTEMPTS = 8;
export const QA_CHROME_ARGS = Object.freeze([
  "--no-first-run",
  "--no-default-browser-check",
  "--disable-http2"
]);

export function isAbortedLoginNavigationError(error) {
  return /net::ERR_ABORTED/i.test(String(error?.message || ""));
}

export function isTransientLoginNavigationError(error) {
  return error?.name === "TimeoutError"
    || /net::ERR_(?:ABORTED|CONNECTION_RESET|CONNECTION_CLOSED|CONNECTION_TIMED_OUT|NAME_NOT_RESOLVED|INTERNET_DISCONNECTED)|ECONNRESET|Transient staging response (?:429|5\d\d)/i.test(String(error?.message || ""));
}

function isExpectedLoginLocation(currentUrl, targetUrl) {
  try {
    const current = new URL(currentUrl);
    return current.origin === targetUrl.origin
      && (current.pathname === "/login" || current.pathname === "/login/");
  } catch {
    return false;
  }
}

async function waitForLoginForm(page, timeoutMs) {
  await page.locator("#login-email").waitFor({ state: "visible", timeout: timeoutMs });
  await page.locator("#login-password").waitFor({ state: "visible", timeout: timeoutMs });
  await page.getByRole("button", { name: "Login", exact: true }).waitFor({ state: "visible", timeout: timeoutMs });
}

/** Navigate to staging login with bounded retries, then verify the form is usable. */
export async function navigateToStagingLogin(page, url, options = {}) {
  const attempts = options.attempts ?? QA_LOGIN_NAVIGATION_ATTEMPTS;
  const navigationTimeoutMs = options.navigationTimeoutMs ?? 15_000;
  const formTimeoutMs = options.formTimeoutMs ?? 8_000;
  const wait = options.wait ?? delay;
  const targetUrl = new URL(url);
  let activePage = page;
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await activePage.goto(url, { waitUntil: "domcontentloaded", timeout: navigationTimeoutMs });
      if (response && (response.status() === 429 || response.status() >= 500)) {
        throw new Error(`Transient staging response ${response.status()}`);
      }
      if (!isExpectedLoginLocation(activePage.url(), targetUrl)) {
        throw new Error("Staging login navigation ended outside the expected staging login URL.");
      }
      await waitForLoginForm(activePage, formTimeoutMs);
      return activePage;
    } catch (error) {
      lastError = error;
      // Chromium may report ERR_ABORTED when the requested document was replaced by
      // a redirect. Accept that only if the final URL is still the staging login
      // route and every login control is visible; otherwise retry or fail closed.
      if (isAbortedLoginNavigationError(error) && isExpectedLoginLocation(activePage.url(), targetUrl)) {
        try {
          await waitForLoginForm(activePage, formTimeoutMs);
          return activePage;
        } catch {
          // The abort did not leave a usable login page; continue through bounded retries.
        }
      }
      if (!isTransientLoginNavigationError(error)) throw error;
      if (attempt === attempts) {
        try { await activePage.close(); } catch { /* preserve the original navigation error */ }
        throw error;
      }
      // Discard an interrupted/failed page before retrying. A fresh page in the same
      // isolated context avoids stale provisional navigations without sharing auth.
      try {
        const context = activePage.context();
        if (!activePage.isClosed()) await activePage.close();
        activePage = await context.newPage();
      } catch {
        // Retain the current page if the browser cannot replace it; the next bounded
        // navigation attempt still fails closed if the staging form is not ready.
      }
      await wait(300 * attempt);
    }
  }

  throw lastError || new Error("The staging login form could not be prepared.");
}

/** Prepare both isolated contexts in order; callers persist nothing until this resolves. */
export async function prepareSequentialLoginPages(contexts, openLoginPage, options = {}) {
  const contextAttempts = options.contextAttempts ?? 2;
  const wait = options.wait ?? delay;
  const pages = [];
  for (const context of contexts) {
    for (let attempt = 1; attempt <= contextAttempts; attempt += 1) {
      try {
        pages.push(await openLoginPage(context));
        break;
      } catch (error) {
        if (!isTransientLoginNavigationError(error) || attempt === contextAttempts) throw error;
        await wait(1_000 * attempt);
      }
    }
  }
  return pages;
}

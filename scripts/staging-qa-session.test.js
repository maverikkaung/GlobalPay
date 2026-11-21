import assert from "node:assert/strict";
import test from "node:test";
import {
  isAbortedLoginNavigationError,
  isTransientLoginNavigationError,
  navigateToStagingLogin,
  prepareSequentialLoginPages,
  QA_CHROME_ARGS
} from "./staging-qa-session.js";

function fakePage({ failNavigationCount = 0, failFormCount = 0, navigationError = null, errorUrl, finalUrl } = {}) {
  const calls = { navigation: 0, form: 0, selectors: [], options: [] };
  let currentUrl = "about:blank";
  const page = {
    url() { return currentUrl; },
    async goto(url, options) {
      calls.navigation += 1;
      calls.options.push(options);
      if (navigationError) {
        currentUrl = errorUrl || "chrome-error://chromewebdata/";
        throw navigationError;
      }
      if (calls.navigation <= failNavigationCount) {
        currentUrl = errorUrl || "chrome-error://chromewebdata/";
        throw Object.assign(new Error("navigation timed out"), { name: "TimeoutError" });
      }
      currentUrl = finalUrl || url;
      return { status: () => 200 };
    },
    locator(selector) {
      return { async waitFor() {
        calls.selectors.push(selector);
        if (selector === "#login-email") {
          calls.form += 1;
          if (calls.form <= failFormCount) throw Object.assign(new Error("form readiness timed out"), { name: "TimeoutError" });
        }
      } };
    },
    getByRole(role, options) {
      calls.selectors.push(`${role}:${options.name}`);
      return { async waitFor() {} };
    }
  };
  return { page, calls };
}

test("staging login waits for DOM readiness and confirms all visible login controls", async () => {
  const { page, calls } = fakePage();
  await navigateToStagingLogin(page, "https://techkarvo-staging.vercel.app/login", { wait: async () => {} });
  assert.equal(calls.navigation, 1);
  assert.equal(calls.options[0].waitUntil, "domcontentloaded");
  assert.deepEqual(calls.selectors, ["#login-email", "#login-password", "button:Login"]);
});

test("QA Chrome uses the transport setting verified to avoid staging resets", () => {
  assert.ok(QA_CHROME_ARGS.includes("--disable-http2"));
  assert.ok(QA_CHROME_ARGS.includes("--no-first-run"));
});

test("transient navigation and form-readiness failures retry only within the configured bound", async () => {
  const { page, calls } = fakePage({ failNavigationCount: 1, failFormCount: 1 });
  await navigateToStagingLogin(page, "https://techkarvo-staging.vercel.app/login", { wait: async () => {} });
  assert.equal(calls.navigation, 3);
  const exhausted = fakePage({ failNavigationCount: 9 });
  await assert.rejects(
    navigateToStagingLogin(exhausted.page, "https://techkarvo-staging.vercel.app/login", { wait: async () => {} }),
    /navigation timed out/
  );
  assert.equal(exhausted.calls.navigation, 8);
});

test("failed navigation retries on a fresh page in the same isolated context", async () => {
  const first = fakePage({ failNavigationCount: 1 });
  const second = fakePage();
  let replaced = false;
  let closed = false;
  first.page.context = () => ({ newPage: async () => { replaced = true; return second.page; } });
  first.page.isClosed = () => closed;
  first.page.close = async () => { closed = true; };
  const result = await navigateToStagingLogin(first.page, "https://techkarvo-staging.vercel.app/login", { wait: async () => {} });
  assert.equal(replaced, true);
  assert.equal(closed, true);
  assert.equal(result, second.page);
  assert.equal(second.calls.navigation, 1);
});

test("ERR_ABORTED is accepted only when it leaves the verified staging login form ready", async () => {
  const aborted = Object.assign(new Error("page.goto: net::ERR_ABORTED"), { name: "Error" });
  const recovered = fakePage({ navigationError: aborted, errorUrl: "https://techkarvo-staging.vercel.app/login" });
  await navigateToStagingLogin(recovered.page, "https://techkarvo-staging.vercel.app/login", { wait: async () => {} });
  assert.equal(recovered.calls.navigation, 1);
  assert.equal(isAbortedLoginNavigationError(aborted), true);

  const unverified = fakePage({ navigationError: aborted });
  await assert.rejects(
    navigateToStagingLogin(unverified.page, "https://techkarvo-staging.vercel.app/login", { attempts: 2, wait: async () => {} }),
    /net::ERR_ABORTED/
  );
  assert.equal(unverified.calls.navigation, 2);
});

test("navigation to a different origin is rejected even if a login form is present", async () => {
  const wrongOrigin = fakePage({ finalUrl: "https://untrusted.example/login" });
  await assert.rejects(
    navigateToStagingLogin(wrongOrigin.page, "https://techkarvo-staging.vercel.app/login", { wait: async () => {} }),
    /outside the expected staging login URL/
  );
  assert.equal(wrongOrigin.calls.navigation, 1);
});

test("sequential context preparation stops cleanly when the second login page fails", async () => {
  const calls = [];
  await assert.rejects(prepareSequentialLoginPages(["client", "freelancer"], async (role) => {
    calls.push(role);
    if (role === "freelancer") throw new Error("transient setup failure");
    return { role };
  }), /transient setup failure/);
  assert.deepEqual(calls, ["client", "freelancer"]);
});

test("a transient second-context failure is retried without reopening the ready first context", async () => {
  const calls = [];
  let freelancerAttempts = 0;
  const pages = await prepareSequentialLoginPages(["client", "freelancer"], async (role) => {
    calls.push(role);
    if (role === "freelancer" && freelancerAttempts++ === 0) {
      throw new Error("page.goto: net::ERR_ABORTED");
    }
    return { role };
  }, { wait: async () => {} });
  assert.deepEqual(calls, ["client", "freelancer", "freelancer"]);
  assert.deepEqual(pages.map((page) => page.role), ["client", "freelancer"]);
});

test("permanent navigation errors do not retry", async () => {
  const { page, calls } = fakePage({ navigationError: new Error("Browser is closed") });
  await assert.rejects(navigateToStagingLogin(page, "https://techkarvo-staging.vercel.app/login", { wait: async () => {} }), /Browser is closed/);
  assert.equal(calls.navigation, 1);
  assert.equal(isTransientLoginNavigationError(new Error("Browser is closed")), false);
});

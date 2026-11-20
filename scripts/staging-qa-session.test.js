import assert from "node:assert/strict";
import test from "node:test";
import { isTransientLoginNavigationError, navigateToStagingLogin } from "./staging-qa-session.js";

function fakePage({ failNavigationCount = 0, failFormCount = 0, navigationError = null } = {}) {
  const calls = { navigation: 0, form: 0, selectors: [], options: [] };
  const page = {
    async goto(_url, options) {
      calls.navigation += 1;
      calls.options.push(options);
      if (navigationError) throw navigationError;
      if (calls.navigation <= failNavigationCount) throw Object.assign(new Error("navigation timed out"), { name: "TimeoutError" });
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

test("transient navigation and form-readiness failures retry only within the configured bound", async () => {
  const { page, calls } = fakePage({ failNavigationCount: 1, failFormCount: 1 });
  await navigateToStagingLogin(page, "https://techkarvo-staging.vercel.app/login", { wait: async () => {} });
  assert.equal(calls.navigation, 3);
  const exhausted = fakePage({ failNavigationCount: 9 });
  await assert.rejects(
    navigateToStagingLogin(exhausted.page, "https://techkarvo-staging.vercel.app/login", { wait: async () => {} }),
    /navigation timed out/
  );
  assert.equal(exhausted.calls.navigation, 3);
});

test("permanent navigation errors do not retry", async () => {
  const { page, calls } = fakePage({ navigationError: new Error("Browser is closed") });
  await assert.rejects(navigateToStagingLogin(page, "https://techkarvo-staging.vercel.app/login", { wait: async () => {} }), /Browser is closed/);
  assert.equal(calls.navigation, 1);
  assert.equal(isTransientLoginNavigationError(new Error("Browser is closed")), false);
});

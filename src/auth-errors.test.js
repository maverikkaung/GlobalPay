import assert from "node:assert/strict";
import test from "node:test";
import { getAuthErrorMessage } from "./auth-errors.js";

test("auth network failures explain that the service could not be reached", () => {
  assert.equal(
    getAuthErrorMessage("Login", new TypeError("Failed to fetch")),
    "TechKarvo could not reach the authentication service. Check your internet or network settings and try again."
  );
});

test("Supabase Auth retryable fetch errors use the network explanation", () => {
  assert.equal(
    getAuthErrorMessage("Signup", { name: "AuthRetryableFetchError", message: "Failed to fetch" }),
    "TechKarvo could not reach the authentication service. Check your internet or network settings and try again."
  );
});

test("known auth error codes return fixed guidance", () => {
  assert.equal(
    getAuthErrorMessage("Signup", { code: "weak_password", message: "Raw provider details" }),
    "Choose a stronger password and try again."
  );
  const invalid = getAuthErrorMessage("Login", { code: "invalid_credentials" });
  assert.match(invalid, /Check your email and password/);
  assert.equal(getAuthErrorMessage("Login", { code: "email_not_confirmed" }), invalid);
});

test("unexpected auth errors receive a safe fallback", () => {
  assert.equal(getAuthErrorMessage("Login", null), "Login failed: Please try again.");
  assert.equal(getAuthErrorMessage("Signup", new Error("Internal database details")), "Signup failed: Please try again.");
});

import assert from "node:assert/strict";
import test from "node:test";
import { getAuthErrorMessage } from "./auth-errors.js";

test("auth network failures explain that the service could not be reached", () => {
  assert.equal(
    getAuthErrorMessage("Login", new TypeError("Failed to fetch")),
    "TechKarvo could not reach the authentication service. Check your internet or network settings and try again."
  );
});

test("auth server errors retain their useful message", () => {
  assert.equal(
    getAuthErrorMessage("Signup", new Error("Email address is invalid")),
    "Signup failed: Email address is invalid"
  );
});

test("unexpected auth errors receive a safe fallback", () => {
  assert.equal(getAuthErrorMessage("Login", null), "Login failed: Please try again.");
});

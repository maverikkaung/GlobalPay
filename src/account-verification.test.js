import test from "node:test";
import assert from "node:assert/strict";
import { getEmailVerificationLabel, getEmailVerificationStatus } from "./account-verification.js";

test("email verification status reflects the Auth user without assuming confirmation", () => {
  assert.equal(getEmailVerificationStatus({ id: "qa-1", email_confirmed_at: "2026-01-01T00:00:00Z" }), "verified");
  assert.equal(getEmailVerificationStatus({ id: "qa-2", email_confirmed_at: null }), "unverified");
  assert.equal(getEmailVerificationStatus({ id: "qa-3" }), "unverified");
});

test("email verification has explicit loading and unavailable states", () => {
  assert.equal(getEmailVerificationLabel("loading"), "Checking verification status…");
  assert.equal(getEmailVerificationStatus(null), "unavailable");
  assert.equal(getEmailVerificationLabel("unavailable"), "Verification status unavailable");
});

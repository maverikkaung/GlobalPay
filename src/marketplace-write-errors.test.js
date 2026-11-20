import assert from "node:assert/strict";
import test from "node:test";
import { getMarketplaceWriteError } from "./marketplace-write-errors.js";

test("monthly job and application credit exhaustion gives role-specific guidance", () => {
  const error = { code: "23514", message: "No usage credits remain in this simulated membership cycle" };
  assert.match(getMarketplaceWriteError(error, "Job posting failed", "job-posting"), /monthly job-posting limit has been reached/i);
  assert.match(getMarketplaceWriteError(error, "Application failed", "application"), /monthly application limit has been reached/i);
});

test("unrecognized write errors stay generic and never expose database details", () => {
  assert.equal(
    getMarketplaceWriteError({ code: "42501", message: "private table denied" }, "Job posting failed", "job-posting"),
    "Job posting failed. Please try again."
  );
});

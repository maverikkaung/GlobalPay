import assert from "node:assert/strict";
import test from "node:test";
import { getRequestErrorMessage } from "./request-errors.js";

test("request network failures include a useful connection hint", () => {
  assert.equal(
    getRequestErrorMessage("Unable to load projects", new TypeError("Failed to fetch")),
    "Unable to load projects. Check your connection and try again."
  );
});

test("request errors do not expose raw database details", () => {
  assert.equal(
    getRequestErrorMessage("Unable to save your profile", { message: "column profiles.private_field does not exist" }),
    "Unable to save your profile. Please try again."
  );
});

test("request errors have a safe fallback when no details are available", () => {
  assert.equal(getRequestErrorMessage("Unable to load notifications", null), "Unable to load notifications. Please try again.");
});

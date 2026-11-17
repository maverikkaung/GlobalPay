import assert from "node:assert/strict";
import test from "node:test";
import { toSafeExternalUrl } from "./external-urls.js";

test("normalizes absolute HTTP and HTTPS URLs", () => {
  assert.equal(toSafeExternalUrl(" https://example.com/work "), "https://example.com/work");
  assert.equal(toSafeExternalUrl("http://example.com"), "http://example.com/");
});

test("rejects non-web, relative, and malformed URLs", () => {
  for (const value of ["javascript:alert(1)", "data:text/html,hello", "ftp://example.com", "/relative", "not a URL", ""]) {
    assert.equal(toSafeExternalUrl(value), null, value);
  }
});

test("rejects URLs containing embedded credentials", () => {
  assert.equal(toSafeExternalUrl("https://user:password@example.com"), null);
  assert.equal(toSafeExternalUrl("https://user@example.com"), null);
});

test("rejects non-string values", () => {
  assert.equal(toSafeExternalUrl(null), null);
  assert.equal(toSafeExternalUrl(undefined), null);
});

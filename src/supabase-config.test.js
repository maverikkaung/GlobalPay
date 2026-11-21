import test from "node:test";
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { getSupabaseBrowserConfig, isPrivilegedSupabaseKey } from "./supabase-config.js";

const token = (role) => `header.${Buffer.from(JSON.stringify({ role })).toString("base64url")}.signature`;

test("prefers the publishable key and keeps legacy anon configuration compatible", () => {
  const config = getSupabaseBrowserConfig({
    VITE_SUPABASE_URL: "https://staging.example.supabase.co",
    VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_public-only",
    VITE_SUPABASE_ANON_KEY: "legacy-anon-value"
  });
  assert.equal(config.configured, true);
  assert.equal(config.key, "sb_publishable_public-only");
  assert.equal(getSupabaseBrowserConfig({
    VITE_SUPABASE_URL: "https://staging.example.supabase.co",
    VITE_SUPABASE_ANON_KEY: "legacy-anon-value"
  }).configured, true);
});

test("rejects modern secret and legacy service-role keys", () => {
  assert.equal(isPrivilegedSupabaseKey("sb_secret_never-browser"), true);
  assert.equal(isPrivilegedSupabaseKey(token("service_role")), true);
  assert.equal(getSupabaseBrowserConfig({
    VITE_SUPABASE_URL: "https://staging.example.supabase.co",
    VITE_SUPABASE_PUBLISHABLE_KEY: "sb_secret_never-browser"
  }).reason, "privileged-key");
  assert.equal(isPrivilegedSupabaseKey(token("anon")), false);
});

test("rejects a privileged key in a lower-priority alias and without a URL", () => {
  assert.equal(getSupabaseBrowserConfig({
    VITE_SUPABASE_URL: "https://example.test",
    VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture",
    VITE_SUPABASE_ANON_KEY: ` ${token("service_role")} `
  }).reason, "privileged-key");
  assert.equal(getSupabaseBrowserConfig({ VITE_SUPABASE_ANON_KEY: " sb_secret_fixture " }).reason, "privileged-key");
});

test("rejects malformed URLs and reports missing public configuration", () => {
  assert.equal(getSupabaseBrowserConfig({ VITE_SUPABASE_URL: "relative/path", VITE_SUPABASE_PUBLISHABLE_KEY: "public" }).reason, "invalid-url");
  assert.equal(getSupabaseBrowserConfig({ VITE_SUPABASE_URL: "https://user:pass@example.com", VITE_SUPABASE_PUBLISHABLE_KEY: "public" }).reason, "invalid-url");
  assert.equal(getSupabaseBrowserConfig({}).reason, "missing");
});

test("requires HTTPS outside loopback development", () => {
  const config = (url) => getSupabaseBrowserConfig({ VITE_SUPABASE_URL: url, VITE_SUPABASE_ANON_KEY: "fixture" });
  assert.equal(config("http://example.test").reason, "invalid-url");
  assert.equal(config("https://example.test?query=value").reason, "invalid-url");
  assert.equal(config("https://example.test").configured, true);
  assert.equal(config("http://127.0.0.1:54321").configured, true);
  assert.equal(config("http://[::1]:54321").configured, true);
});

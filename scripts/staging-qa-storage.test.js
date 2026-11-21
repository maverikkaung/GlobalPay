import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { persistRotatedSession, qaSessionPaths, sessionStatus, shouldPersistSession, stagingOrigin, stagingProjectRef } from "./staging-qa-storage.js";

function state({ user = "qa-client", refresh = "old", expires = 3_000, origin = stagingOrigin } = {}) {
  return {
    cookies: [],
    origins: [{
      origin,
      localStorage: [{
        name: `sb-${stagingProjectRef}-auth-token`,
        value: JSON.stringify({ user: { id: user }, access_token: "fixture", refresh_token: refresh, expires_at: expires })
      }]
    }]
  };
}

test("QA session paths use the selected directory and respect per-role overrides", () => {
  const paths = qaSessionPaths({ TK_QA_SESSION_DIR: "fixture", TK_QA_CLIENT_STORAGE_STATE: "custom-client.json" });
  assert.equal(paths.Client, "custom-client.json");
  assert.equal(paths.Freelancer, join("fixture", "freelancer.json"));
});

test("session diagnostics distinguish invalid, expired and unexpired staging storage", () => {
  assert.equal(sessionStatus(state({ origin: "https://example.test" }), 0), "missing or invalid");
  assert.equal(sessionStatus(state(), 3_000_000), "expired access token; refresh available");
  assert.equal(sessionStatus(state(), 2_999_999), "unexpired");
});

test("only a current rotated session for the same account can replace saved storage", () => {
  const previous = state();
  const now = 2_000_000;
  assert.equal(shouldPersistSession(previous, state({ refresh: "new" }), now), true);
  assert.equal(shouldPersistSession(previous, {}, now), false);
  assert.equal(shouldPersistSession(previous, state({ user: "another", refresh: "new" }), now), false);
  assert.equal(shouldPersistSession(previous, state({ refresh: "new", expires: 2_999 }), now), false);
  assert.equal(shouldPersistSession(previous, state({ expires: 4_000 }), now), false);
});

test("a teardown rotation can be loaded by the next test and a later sign-out preserves it", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "techkarvo-storage-test-"));
  t.after(() => rm(directory, { recursive: true }));
  const path = join(directory, "client.json");
  const future = Math.ceil(Date.now() / 1000) + 3600;
  const initial = state({ expires: future });
  const afterLogin = state({ refresh: "after-login", expires: future + 1 });
  const afterTest = state({ refresh: "after-test", expires: future + 2 });
  await writeFile(path, JSON.stringify(initial));
  assert.equal(await persistRotatedSession(path, initial, afterLogin), true);
  assert.equal(await persistRotatedSession(path, afterLogin, afterTest), true);
  assert.equal(await persistRotatedSession(path, afterTest, {}), false);
  assert.deepEqual(JSON.parse(await readFile(path, "utf8")), afterTest);
  const backups = (await readdir(directory)).filter((file) => file.startsWith("client.json.backup-"));
  assert.equal(backups.length, 2);
  const recovered = await Promise.all(backups.map(async (file) => JSON.parse(await readFile(join(directory, file), "utf8"))));
  assert.ok(recovered.some((entry) => JSON.stringify(entry) === JSON.stringify(initial)));
  assert.ok(recovered.some((entry) => JSON.stringify(entry) === JSON.stringify(afterLogin)));
  assert.equal((await readdir(directory)).length, 3);
});

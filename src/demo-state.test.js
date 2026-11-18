import test from "node:test";
import assert from "node:assert/strict";
import { createDemoState, DEMO_STORAGE_KEY, readDemoState, resetDemoState, writeDemoState } from "./demo-state.js";

function createMemoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
    values
  };
}

test("demo seed includes separate client/freelancer workflows and social content", () => {
  const demo = createDemoState();
  assert.equal(demo.role, "freelancer");
  assert.ok(demo.jobs.length >= 2);
  assert.ok(demo.applications.some((application) => application.status === "Pending"));
  assert.ok(demo.applications.some((application) => application.status === "Accepted"));
  assert.ok(demo.posts.length > 0);
  assert.ok(demo.messages.length > 0);
});

test("demo state persists only under its isolated local storage key", () => {
  const storage = createMemoryStorage();
  const demo = { ...createDemoState(), role: "client" };
  assert.equal(writeDemoState(demo, storage), true);
  assert.deepEqual(JSON.parse(storage.getItem(DEMO_STORAGE_KEY)), demo);
  assert.equal(storage.values.size, 1);
});

test("invalid demo state returns a safe sample and reset restores the seed", () => {
  const storage = createMemoryStorage({ [DEMO_STORAGE_KEY]: "not-json" });
  assert.deepEqual(readDemoState(storage), createDemoState());
  writeDemoState({ role: "client", jobs: [] }, storage);
  const reset = resetDemoState(storage);
  assert.deepEqual(reset, createDemoState());
  assert.equal(storage.getItem(DEMO_STORAGE_KEY), null);
});

test("demo storage failures do not prevent use of an in-memory session", () => {
  const brokenStorage = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); }, removeItem() { throw new Error("blocked"); } };
  assert.deepEqual(readDemoState(brokenStorage), createDemoState());
  assert.equal(writeDemoState(createDemoState(), brokenStorage), false);
  assert.equal(resetDemoState(brokenStorage).jobs.length, createDemoState().jobs.length);
});

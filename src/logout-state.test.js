import assert from "node:assert/strict";
import test from "node:test";
import { clearLegacyUserAfterLogout } from "./logout-state.js";

test("successful sign-out clears the legacy user cache", () => {
  const removed = [];
  clearLegacyUserAfterLogout({ error: null }, { removeItem: (key) => removed.push(key) });
  assert.deepEqual(removed, ["TechKarvo_current_user"]);
});

test("failed sign-out keeps the legacy user cache", () => {
  let removeCalled = false;
  clearLegacyUserAfterLogout({ error: new Error("network failure") }, {
    removeItem: () => { removeCalled = true; }
  });
  assert.equal(removeCalled, false);
});

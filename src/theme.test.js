import assert from "node:assert/strict";
import test from "node:test";
import { getStoredTheme, normalizeTheme, saveThemePreference, THEME_STORAGE_KEY } from "./theme.js";

function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, String(value)); }
  };
}

test("theme preferences default to TechKarvo dark mode and accept light mode", () => {
  assert.equal(normalizeTheme("light"), "light");
  assert.equal(normalizeTheme("invalid"), "dark");
  assert.equal(getStoredTheme(createStorage()), "dark");
  assert.equal(getStoredTheme(createStorage({ [THEME_STORAGE_KEY]: "light" })), "light");
});

test("theme preference persists locally and handles blocked storage safely", () => {
  const storage = createStorage();
  assert.equal(saveThemePreference(storage, "light"), true);
  assert.equal(storage.getItem(THEME_STORAGE_KEY), "light");
  assert.equal(saveThemePreference({ setItem() { throw new Error("blocked"); } }, "dark"), false);
  assert.equal(getStoredTheme({ getItem() { throw new Error("blocked"); } }), "dark");
});

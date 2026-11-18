export const THEME_STORAGE_KEY = "techkarvo-theme";

export function normalizeTheme(value) {
  return value === "light" ? "light" : "dark";
}

export function getStoredTheme(storage) {
  try {
    return normalizeTheme(storage?.getItem(THEME_STORAGE_KEY));
  } catch {
    return "dark";
  }
}

export function saveThemePreference(storage, theme) {
  try {
    storage?.setItem(THEME_STORAGE_KEY, normalizeTheme(theme));
    return true;
  } catch {
    return false;
  }
}

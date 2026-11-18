import { useCallback, useEffect, useMemo, useState } from "react";
import { ThemeContext } from "./theme-context.js";
import { getStoredTheme, normalizeTheme, saveThemePreference } from "./theme.js";

function browserStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => getStoredTheme(browserStorage()));

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    saveThemePreference(browserStorage(), theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((current) => {
      const next = normalizeTheme(current) === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      saveThemePreference(browserStorage(), next);
      return next;
    });
  }, []);

  const value = useMemo(() => ({ theme, toggleTheme }), [theme, toggleTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export type Theme = "light" | "dark";
/** "system" follows the device (nothing stored, no data-theme attribute). */
export type ThemePreference = Theme | "system";

const STORAGE_KEY = "msma-hris-theme";
/** Fired whenever the theme changes, so every theme control (moon toggle, gear menu, Settings) stays in sync. */
export const THEME_EVENT = "heyhr-theme-change";

export function getStoredTheme(): Theme | null {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === "light" || stored === "dark" ? stored : null;
}

export function getEffectiveTheme(): Theme {
  return getStoredTheme() ?? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
}

export function getThemePreference(): ThemePreference {
  return getStoredTheme() ?? "system";
}

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(STORAGE_KEY, theme);
  window.dispatchEvent(new Event(THEME_EVENT));
}

export function setThemePreference(pref: ThemePreference) {
  if (pref !== "system") return applyTheme(pref);
  delete document.documentElement.dataset.theme;
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event(THEME_EVENT));
}

/** Subscribe to theme changes (any control, or the device switching light/dark under "system"). */
export function subscribeTheme(onChange: () => void) {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  window.addEventListener(THEME_EVENT, onChange);
  media.addEventListener("change", onChange);
  return () => {
    window.removeEventListener(THEME_EVENT, onChange);
    media.removeEventListener("change", onChange);
  };
}

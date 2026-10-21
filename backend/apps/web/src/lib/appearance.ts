import type { Preferences } from '@msma/shared';

const PREFS_KEY = 'msma-prefs';

/** Web default: Light (see CLAUDE.md). `theme: null` means "app default". */
export function effectiveTheme(prefs: Preferences): 'LIGHT' | 'DARK' | 'SYSTEM' {
  return prefs.theme ?? 'LIGHT';
}

let mediaCleanup: (() => void) | null = null;

/** Apply theme, text size and table density to <html>, and cache them for the pre-paint script. */
export function applyAppearance(prefs: Preferences) {
  const html = document.documentElement;
  const theme = effectiveTheme(prefs);
  mediaCleanup?.();
  mediaCleanup = null;
  const setDark = (dark: boolean) => html.classList.toggle('dark', dark);
  if (theme === 'SYSTEM') {
    const mq = matchMedia('(prefers-color-scheme: dark)');
    setDark(mq.matches);
    const listener = (e: MediaQueryListEvent) => setDark(e.matches);
    mq.addEventListener('change', listener);
    mediaCleanup = () => mq.removeEventListener('change', listener);
  } else {
    setDark(theme === 'DARK');
  }
  html.dataset.textSize = prefs.textSize;
  html.dataset.density = prefs.tableDensity;
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // ignore
  }
}

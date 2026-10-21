import { colors, type ColorTokens } from '@msma/shared';
import * as SystemUI from 'expo-system-ui';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import { LOOK, type Look } from './looks';

/** Light, Dark or System (follow the phone), saved like the website's theme (same key, nothing stored = System). */
export type ThemePreference = 'light' | 'dark' | 'system';
const KEY = 'msma-hris-theme';

interface Theme {
  c: ColorTokens;
  dark: boolean;
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => void;
  /** The app's look: Glass (lib/looks). */
  look: Look;
}

const read = (): ThemePreference => {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
};

const ThemeContext = createContext<Theme>({ c: colors.light, dark: false, preference: 'system', setPreference: () => undefined, look: LOOK });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [preference, setPref] = useState<ThemePreference>(read);
  const dark = preference === 'dark' || (preference === 'system' && system === 'dark');
  const value = useMemo<Theme>(
    () => ({
      c: dark ? colors.dark : colors.light,
      dark,
      preference,
      look: LOOK,
      setPreference(p) {
        try {
          if (p === 'system') localStorage.removeItem(KEY);
          else localStorage.setItem(KEY, p);
        } catch {
          // Kept for this launch only.
        }
        setPref(p);
      },
    }),
    [dark, preference],
  );

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(value.c.bg).catch(() => undefined);
  }, [value.c.bg]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);

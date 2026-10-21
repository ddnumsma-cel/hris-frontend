import { colors, type ColorTokens, type ThemePreference } from '@msma/shared';
import * as SystemUI from 'expo-system-ui';
import { createContext, useContext, useEffect, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { useAuth } from './auth';

interface Theme {
  c: ColorTokens;
  dark: boolean;
  preference: ThemePreference;
}

const ThemeContext = createContext<Theme>({ c: colors.light, dark: false, preference: 'SYSTEM' });

/** Mobile default is "Match my device" (see CLAUDE.md); a saved account preference overrides it. */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const { user } = useAuth();
  const preference: ThemePreference = user?.preferences.theme ?? 'SYSTEM';
  const dark = preference === 'DARK' || (preference === 'SYSTEM' && system === 'dark');
  const value = useMemo(
    () => ({ c: dark ? colors.dark : colors.light, dark, preference }),
    [dark, preference],
  );

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(value.c.bg).catch(() => undefined);
  }, [value.c.bg]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);

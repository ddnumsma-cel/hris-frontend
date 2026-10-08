import { useSyncExternalStore } from "react";
import { getEffectiveTheme, getThemePreference, subscribeTheme } from "./theme";

/** The chosen theme (Light / Dark / System), kept in sync with every theme control. */
export const useThemePreference = () => useSyncExternalStore(subscribeTheme, getThemePreference);
/** The theme actually showing (System resolved to Light or Dark). */
export const useEffectiveTheme = () => useSyncExternalStore(subscribeTheme, getEffectiveTheme);

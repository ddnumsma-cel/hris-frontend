// The app's look ("Glass", chosen 2026-10-20 over Classic, Soft and Bold): a soft blue wash fading down behind every
// screen, frosted translucent cards with a light shadow, and softer corners. Cards, buttons and the screen
// background follow it (ThemeProvider exposes it as `look`).

import type { ColorTokens } from '@msma/shared';
import type { ViewStyle } from 'react-native';

export interface Look {
  /** Corner radius of cards and of buttons / fields. */
  cardRadius: number;
  controlRadius: number;
  /** A card's fill, outline and shadow. */
  card: (c: ColorTokens, dark: boolean) => ViewStyle;
  /** The gradient behind every screen: top colour → page colour. */
  wash: (c: ColorTokens, dark: boolean) => [string, string];
  /** Space between cards. */
  gap: number;
}

export const LOOK: Look = {
  cardRadius: 16,
  controlRadius: 12,
  card: (c, dark) => ({
    backgroundColor: dark ? 'rgba(35, 44, 56, 0.72)' : 'rgba(255, 255, 255, 0.6)',
    borderColor: dark ? 'rgba(233, 238, 243, 0.08)' : 'rgba(255, 255, 255, 0.9)',
    borderWidth: 1,
    shadowColor: dark ? '#000000' : '#1E293B',
    shadowOpacity: dark ? 0.12 : 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  }),
  wash: (c, dark) => [dark ? '#22324A' : '#CFE4FB', c.bg],
  gap: 16,
};

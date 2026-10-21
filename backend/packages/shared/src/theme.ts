/** Design tokens shared by web (CSS variables) and mobile. See CLAUDE.md "UI and design decisions". */
export const colors = {
  light: {
    bg: '#F6F5F1',
    card: '#FFFFFF',
    sidebar: '#1B1D1F',
    sidebarText: '#ECEAE4',
    text: '#1B1D1F',
    muted: '#5F6368',
    border: '#E4E2DC',
    accent: '#0E6B63',
    accentSoft: '#E3F0EE',
    onAccent: '#FFFFFF',
    success: '#067647',
    successSoft: '#E6F4EC',
    warning: '#B45309',
    warningSoft: '#FDF1E3',
    danger: '#B42318',
    dangerSoft: '#FDECEA',
  },
  dark: {
    bg: '#111315',
    card: '#1B1D1F',
    sidebar: '#0B0C0D',
    sidebarText: '#ECEAE4',
    text: '#ECEAE4',
    muted: '#A1A4A8',
    border: '#2C2F33',
    accent: '#3DB5A8',
    accentSoft: '#15302D',
    onAccent: '#0B0C0D',
    success: '#47CD89',
    successSoft: '#142B20',
    warning: '#F5A524',
    warningSoft: '#33250F',
    danger: '#F97066',
    dangerSoft: '#3A1A17',
  },
} as const;

export type ColorScheme = keyof typeof colors;
export type ColorTokens = { [K in keyof (typeof colors)['light']]: string };

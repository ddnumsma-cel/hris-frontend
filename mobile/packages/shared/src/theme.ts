/**
 * Mobile UI design tokens: the website's "Slate & Sky" design (hris-frontend/src/index.css), light and
 * dark (Steel & Ice). Keep the values in step with index.css when the website's tokens change.
 */
export const colors = {
  light: {
    bg: '#E9EFF7',
    card: 'rgba(255, 255, 255, 0.62)',
    cardBorder: 'rgba(255, 255, 255, 0.85)',
    surfaceRaised: '#F7F9FC',
    dashCard: '#FFFFFF',
    dashHairline: 'rgba(30, 41, 59, 0.1)',
    tint: 'rgba(236, 242, 249, 0.75)',
    fieldBg: '#FFFFFF',
    sidebar: '#1E293B',
    sidebarText: '#FFFFFF',
    text: '#1E293B',
    muted: '#536279',
    border: 'rgba(30, 41, 59, 0.14)',
    line: 'rgba(30, 41, 59, 0.07)',
    accent: '#1D4ED8',
    accentSoft: 'rgba(90, 176, 240, 0.16)',
    onAccent: '#FFFFFF',
    gradStart: '#2775D3',
    gradEnd: '#1D4ED8',
    focusRing: 'rgba(37, 99, 235, 0.55)',
    logoInk: '#1E293B',
    brandLime: '#BFD813',
    success: '#17734A',
    successSoft: '#E3F3EA',
    warning: '#8A5A12',
    warningSoft: '#FBF0DC',
    danger: '#A3261F',
    dangerSoft: '#FBE4E3',
    onDanger: '#FFFFFF',
  },
  dark: {
    bg: '#1A212B',
    card: '#232C38',
    cardBorder: '#333E4C',
    surfaceRaised: '#263040',
    dashCard: '#232C38',
    dashHairline: '#333E4C',
    tint: '#2A3441',
    fieldBg: '#1A212B',
    sidebar: '#141A22',
    sidebarText: '#E9EEF3',
    text: '#E9EEF3',
    muted: '#A0AAB7',
    border: '#333E4C',
    line: 'rgba(233, 238, 243, 0.07)',
    accent: '#9CD3F7',
    accentSoft: 'rgba(156, 211, 247, 0.14)',
    onAccent: '#1A212B',
    gradStart: '#B5DEF9',
    gradEnd: '#9CD3F7',
    focusRing: 'rgba(156, 211, 247, 0.75)',
    logoInk: '#FFFFFF',
    brandLime: '#BFD813',
    success: '#6FD3A0',
    successSoft: '#1B3A2D',
    warning: '#F0C066',
    warningSoft: '#3B2F1A',
    danger: '#F58C86',
    dangerSoft: '#3F2327',
    onDanger: '#FFFFFF',
  },
} as const;

/** The website's radii (--radius-*). */
export const radius = { panel: 20, modal: 16, card: 12, userCard: 10, control: 9, logo: 7, pill: 999 } as const;

export type ColorScheme = keyof typeof colors;
export type ColorTokens = { [K in keyof (typeof colors)['light']]: string };

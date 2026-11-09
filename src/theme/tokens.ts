/**
 * Design tokens (spec section 23.1). Text tokens meet 4.5:1 contrast on every surface and button
 * labels on their fills, in both themes — checked by tests/unit/a11y-contrast.test.ts.
 */
export const palette = {
  dark: {
    background: '#121417',
    surface: '#1B1E23',
    surfaceRaised: '#23272E',
    border: '#2E333B',
    textPrimary: '#F2F4F7',
    textSecondary: '#A3AAB5',
    accent: '#34D399',
    onAccent: '#0B1F17',
    warning: '#F5A524',
    danger: '#F97066',
    info: '#60A5FA',
    onDanger: '#1A0B0A',
    overlay: 'rgba(0,0,0,0.6)',
  },
  light: {
    background: '#F7F8FA',
    surface: '#FFFFFF',
    surfaceRaised: '#F0F2F5',
    border: '#E1E4E8',
    textPrimary: '#101318',
    textSecondary: '#5A6270',
    accent: '#047857',
    onAccent: '#FFFFFF',
    warning: '#A3480A',
    danger: '#C4281C',
    info: '#2563EB',
    onDanger: '#FFFFFF',
    overlay: 'rgba(16,19,24,0.45)',
  },
} as const;

export type ColorScheme = keyof typeof palette;
export type Colors = { [K in keyof (typeof palette)['dark']]: string };

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
} as const;
export const radius = { input: 8, button: 12, card: 16, sheet: 24, pill: 999 } as const;

export const typography = {
  caption: { fontSize: 12, lineHeight: 16 },
  small: { fontSize: 14, lineHeight: 20 },
  body: { fontSize: 16, lineHeight: 24 },
  bodyStrong: { fontSize: 16, lineHeight: 24, fontWeight: '600' },
  title: { fontSize: 18, lineHeight: 24, fontWeight: '600' },
  heading: { fontSize: 22, lineHeight: 28, fontWeight: '700' },
  display: { fontSize: 28, lineHeight: 34, fontWeight: '700' },
  hero: { fontSize: 34, lineHeight: 40, fontWeight: '700' },
} as const;
export type TypographyVariant = keyof typeof typography;

/** Minimum touch target (spec 23.3). */
export const TOUCH_TARGET = 44;

export const motion = { fast: 150, normal: 250 } as const;

import { palette } from '@/theme/tokens';

/** WCAG 2.x relative luminance and contrast ratio. */
const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r!) + 0.7152 * lin(g!) + 0.0722 * lin(b!);
};
const ratio = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x! + 0.05) / (y! + 0.05);
};

describe.each(['dark', 'light'] as const)('colour contrast, %s theme (spec 23.3)', (scheme) => {
  const c = palette[scheme];
  const backgrounds = {
    background: c.background,
    surface: c.surface,
    surfaceRaised: c.surfaceRaised,
    successSurface: c.successSurface,
    warningSurface: c.warningSurface,
    dangerSurface: c.dangerSurface,
  };
  // Text colours used for body and small text need 4.5:1 on every surface they appear on.
  it.each(['textPrimary', 'textSecondary', 'accent', 'warning', 'danger', 'info'] as const)(
    '%s text ≥ 4.5:1 on all surfaces',
    (token) => {
      const worst = Math.min(...Object.values(backgrounds).map((bg) => ratio(c[token], bg)));
      expect(worst).toBeGreaterThanOrEqual(4.5);
    },
  );
  it('button labels ≥ 4.5:1 on their fills', () => {
    expect(ratio(c.onAccent, c.accent)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(c.onDanger, c.danger)).toBeGreaterThanOrEqual(4.5);
  });
});

/** Avatar colours a social profile can pick (same keys as the database check). */
export const AVATAR_COLORS = {
  mint: '#34D399',
  sky: '#38BDF8',
  violet: '#A78BFA',
  rose: '#FB7185',
  amber: '#FBBF24',
  lime: '#A3E635',
  teal: '#2DD4BF',
  slate: '#94A3B8',
} as const;

export type AvatarColor = keyof typeof AVATAR_COLORS;
export const AVATAR_COLOR_KEYS = Object.keys(AVATAR_COLORS) as AvatarColor[];

export function avatarHex(key: string): string {
  return AVATAR_COLORS[key as AvatarColor] ?? AVATAR_COLORS.slate;
}

/** One or two letters: "Ana Marić" → "AM", "bob" → "B". */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = [...parts[0]!][0] ?? '';
  const last = parts.length > 1 ? ([...parts[parts.length - 1]!][0] ?? '') : '';
  return (first + last).toUpperCase();
}

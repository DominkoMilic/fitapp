/** Avatar colours, assigned from the user id (same keys and order as the database). */
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

/**
 * The colour the database assigns to a user (social_avatar_color): the first 32 bits of the id
 * pick one of the 8 colours. Used to preview the avatar before the profile exists.
 */
export function avatarColorFor(userId: string): AvatarColor {
  const n = parseInt(userId.replace(/-/g, '').slice(0, 8), 16);
  return AVATAR_COLOR_KEYS[Number.isFinite(n) ? n % AVATAR_COLOR_KEYS.length : 0] ?? 'slate';
}

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

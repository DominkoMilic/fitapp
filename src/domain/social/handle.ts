import { RESERVED_HANDLES, textAllowed } from './filter';

export const HANDLE_MIN = 3;
export const HANDLE_MAX = 20;
export const DISPLAY_NAME_MAX = 40;
export const BIO_MAX = 140;

export type HandleError = 'too_short' | 'too_long' | 'characters' | 'reserved' | 'not_allowed';

/** Handles are stored lower-case, without surrounding spaces or a leading @. */
export function normaliseHandle(raw: string): string {
  return raw.trim().replace(/^@/, '').toLowerCase();
}

/** Same rules as the database (`^[a-z0-9_.]{3,20}$`, reserved list, word filter). */
export function validateHandle(raw: string): HandleError | null {
  const h = normaliseHandle(raw);
  if (h.length < HANDLE_MIN) return 'too_short';
  if (h.length > HANDLE_MAX) return 'too_long';
  if (!/^[a-z0-9_.]+$/.test(h)) return 'characters';
  if (RESERVED_HANDLES.includes(h)) return 'reserved';
  if (!textAllowed(h)) return 'not_allowed';
  return null;
}

export const HANDLE_ERROR_TEXT: Record<HandleError, string> = {
  too_short: `At least ${HANDLE_MIN} characters.`,
  too_long: `At most ${HANDLE_MAX} characters.`,
  characters: 'Use letters, numbers, _ and . only.',
  reserved: 'That handle is reserved. Try another.',
  not_allowed: 'That handle is not allowed. Try another.',
};

/** A starting handle from a display name ("Ana Marić" → "ana.maric"); empty if none fits. */
export function suggestHandle(displayName: string): string {
  const base = displayName
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '.')
    .replace(/[^a-z0-9_.]/g, '')
    .replace(/\.{2,}/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .slice(0, HANDLE_MAX);
  return validateHandle(base) ? '' : base;
}

/** Name and bio: trimmed, within limits, and passing the word filter. */
export function validateDisplayName(raw: string): 'required' | 'too_long' | 'not_allowed' | null {
  const t = raw.trim();
  if (!t) return 'required';
  if (t.length > DISPLAY_NAME_MAX) return 'too_long';
  return textAllowed(t) ? null : 'not_allowed';
}

export function validateBio(raw: string): 'too_long' | 'not_allowed' | null {
  if (raw.trim().length > BIO_MAX) return 'too_long';
  return textAllowed(raw) ? null : 'not_allowed';
}

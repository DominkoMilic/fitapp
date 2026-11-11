import { RESERVED_HANDLES, textAllowed } from './filter';

export const HANDLE_MIN = 3;
export const HANDLE_MAX = 20;
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

/**
 * The social username (spec 33.8): 3–20 letters, numbers, _ or ., no spaces. It is chosen once
 * and can't be changed; the handle is its lowercase form, so names are unique regardless of case
 * (Dominko and DoMInKo are the same name, @dominko).
 */
export function validateSocialName(raw: string): HandleError | null {
  const t = raw.trim();
  if (t.length >= HANDLE_MIN && t.length <= HANDLE_MAX && !/^[A-Za-z0-9_.]+$/.test(t))
    return 'characters';
  return validateHandle(t);
}

/** The handle for a username: its lowercase form ("Dominko" → "dominko"). */
export const handleFor = (name: string): string => name.trim().toLowerCase();

export const SOCIAL_NAME_ERROR_TEXT: Record<HandleError, string> = {
  too_short: `At least ${HANDLE_MIN} characters.`,
  too_long: `At most ${HANDLE_MAX} characters.`,
  characters: 'Use letters, numbers, _ and . only, without spaces.',
  reserved: 'That name is reserved. Try another.',
  not_allowed: 'That name is not allowed. Try another.',
};

/** A starting username from the profile name ("Ana Marić" → "AnaMaric"); empty if none fits. */
export function suggestSocialName(profileName: string): string {
  const base = profileName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/\s+/g, '')
    .replace(/[^A-Za-z0-9_.]/g, '')
    .slice(0, HANDLE_MAX);
  return validateSocialName(base) ? '' : base;
}

export function validateBio(raw: string): 'too_long' | 'not_allowed' | null {
  if (raw.trim().length > BIO_MAX) return 'too_long';
  return textAllowed(raw) ? null : 'not_allowed';
}

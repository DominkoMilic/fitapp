/** How another person relates to you (as returned by the database). */
export type Relationship = 'none' | 'outgoing' | 'incoming' | 'friends' | 'blocked';

export type PrimaryAction = 'add' | 'cancel' | 'accept' | 'none' | 'unblock';

/** The one main action a profile shows for each relationship. */
export function primaryAction(rel: Relationship): PrimaryAction {
  switch (rel) {
    case 'none':
      return 'add';
    case 'outgoing':
      return 'cancel';
    case 'incoming':
      return 'accept';
    case 'blocked':
      return 'unblock';
    case 'friends':
      return 'none';
  }
}

export const RELATIONSHIP_LABEL: Record<Relationship, string> = {
  none: '',
  outgoing: 'Request sent',
  incoming: 'Wants to be friends',
  friends: 'Friends',
  blocked: 'Blocked',
};

export interface FriendRow {
  user_id: string;
  handle: string;
  display_name: string;
  avatar_color: string;
  relationship: Relationship;
  since: string;
}

/** Splits the friendship list for the Friends screen: requests first, then friends, then sent. */
export function groupFriendships(rows: readonly FriendRow[]) {
  return {
    incoming: rows.filter((r) => r.relationship === 'incoming'),
    friends: rows.filter((r) => r.relationship === 'friends'),
    outgoing: rows.filter((r) => r.relationship === 'outgoing'),
  };
}

/** Social action errors raised by the database, mapped to what the user reads. */
export const SOCIAL_ERRORS = {
  rate_limited: 'Too many tries. Please wait a little and try again.',
  not_found: 'We couldn’t find that person.',
  blocked: 'You blocked this person. Unblock them first.',
  requests_closed: 'This person isn’t accepting friend requests.',
  friend_limit: 'Friend limit reached (500).',
  handle_taken: 'That name is taken. Try another.',
  handle_reserved: 'That name is reserved. Try another.',
  identity_locked: 'Your username can’t be changed.',
  comments_off: 'Comments are turned off for this post.',
  not_allowed: 'That text isn’t allowed. Please change it.',
  social_disabled: 'Social is unavailable right now. Please try again later.',
  social_off: 'Turn on Social in Settings → App features first.',
  no_profile: 'Set up your social profile first.',
  banned: 'Your social profile has been suspended.',
  network: 'No connection. Nothing was changed.',
  unknown: 'Something went wrong. Nothing was changed.',
} as const;

export type SocialErrorCode = keyof typeof SOCIAL_ERRORS;

/** Picks the code out of a database or network error. */
export function socialErrorCode(
  err: { message?: string; code?: string } | null | undefined,
): SocialErrorCode {
  if (!err) return 'unknown';
  if (err.code === '23505') return 'handle_taken';
  const msg = err.message ?? '';
  if (/network|fetch|timed? ?out/i.test(msg)) return 'network';
  const known = Object.keys(SOCIAL_ERRORS) as SocialErrorCode[];
  return known.find((k) => msg === k || msg.includes(k)) ?? 'unknown';
}

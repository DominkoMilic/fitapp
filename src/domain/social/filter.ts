/**
 * Word filter for handles, names, bios and (later) comments and club names (spec 33.7).
 * The same lists are seeded in the database (migration 20261117000100_social_friends.sql), which
 * enforces them with a trigger; a unit test keeps both copies identical.
 */

export const BLOCKED_WORDS: readonly string[] = [
  'fuck',
  'shit',
  'cunt',
  'bitch',
  'nigger',
  'nigga',
  'faggot',
  'fag',
  'retard',
  'whore',
  'slut',
  'rape',
  'rapist',
  'nazi',
  'hitler',
  'porn',
  'pussy',
  'wank',
  'twat',
  'kys',
];

export const RESERVED_HANDLES: readonly string[] = [
  'admin',
  'administrator',
  'pace',
  'paceapp',
  'pace_app',
  'support',
  'help',
  'moderator',
  'mod',
  'official',
  'staff',
  'team',
  'system',
  'root',
  'null',
  'undefined',
  'settings',
  'social',
  'add',
  'api',
  'www',
];

const LOOK_ALIKE: Record<string, string> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '@': 'a',
  $: 's',
};

/** Lower case with look-alike characters mapped to letters (same as SQL `social_normalise`). */
export function normaliseForFilter(text: string): string {
  return [...text.toLowerCase()].map((c) => LOOK_ALIKE[c] ?? c).join('');
}

/**
 * False when a word of the text is a blocked word, or starts with one of 4+ letters
 * (same rule as SQL `social_text_ok`).
 */
export function textAllowed(text: string | null | undefined): boolean {
  if (!text) return true;
  const tokens = normaliseForFilter(text)
    .split(/[^a-z]+/)
    .filter(Boolean);
  return !tokens.some((tok) =>
    BLOCKED_WORDS.some((w) => tok === w || (w.length >= 4 && tok.startsWith(w))),
  );
}

/**
 * Word filter for handles, names, bios, comments and club names (spec 33.7).
 * The same lists are seeded in the database (migrations 20261117000100_social_friends.sql and
 * 20261122000100_social_comment_moderation.sql), which enforces them with triggers; a unit test
 * keeps both copies identical.
 *
 * Two severities: blocked words (slurs, hate, sexual violence, self-harm) are always refused;
 * flagged words (swearing) are refused in names and bios, but in comments they are accepted and
 * the post owner is alerted so they can remove the comment.
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

/** Swearing: flagged in comments (English from the first list, plus Croatian/regional). */
export const FLAGGED_WORDS: readonly string[] = [
  'fuck',
  'shit',
  'bitch',
  'pussy',
  'wank',
  'twat',
  'jebe',
  'jebo',
  'jebi',
  'jeba',
  'kurac',
  'kurc',
  'picka',
  'picke',
  'picki',
  'picku',
  'pizd',
  'sranj',
  'govn',
  'kurv',
  'drka',
  'debil',
  'kreten',
  'idiot',
  'smrad',
  'glupan',
];

/** Regional slurs, always refused. */
export const REGIONAL_BLOCKED_WORDS: readonly string[] = [
  'peder',
  'cigan',
  'ustas',
  'cetnik',
  'balij',
  'siptar',
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
  č: 'c',
  ć: 'c',
  š: 's',
  ž: 'z',
  đ: 'd',
};

/** Lower case with look-alike characters mapped to letters (same as SQL `social_normalise`). */
export function normaliseForFilter(text: string): string {
  return [...text.toLowerCase()].map((c) => LOOK_ALIKE[c] ?? c).join('');
}

const tokens = (text: string) =>
  normaliseForFilter(text)
    .split(/[^a-z]+/)
    .filter(Boolean);

const hits = (text: string | null | undefined, words: readonly string[]) =>
  !!text &&
  tokens(text).some((tok) => words.some((w) => tok === w || (w.length >= 4 && tok.startsWith(w))));

const ALL_WORDS = [...new Set([...BLOCKED_WORDS, ...FLAGGED_WORDS, ...REGIONAL_BLOCKED_WORDS])];
const BLOCK_ONLY = ALL_WORDS.filter((w) => !FLAGGED_WORDS.includes(w));

/**
 * Names, handles and bios: false when a word of the text is any listed word, or starts with one
 * of 4+ letters (same rule as SQL `social_text_ok`).
 */
export function textAllowed(text: string | null | undefined): boolean {
  return !hits(text, ALL_WORDS);
}

/** Comments: only blocked words are refused (SQL `comments_check`). */
export function commentAllowed(text: string | null | undefined): boolean {
  return !hits(text, BLOCK_ONLY);
}

/** True when a comment contains swearing the post owner is alerted about. */
export function isFlagged(text: string | null | undefined): boolean {
  return hits(text, FLAGGED_WORDS);
}

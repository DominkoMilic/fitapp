/**
 * Sports PACE supports (all-sport support). Single source of truth for labels, event names,
 * calorie values and which body areas a sport loads (injury rules). Pure, no imports.
 *
 * Sport events are stored as categories `<sport>_<type>` (e.g. `basketball_match`,
 * `table_tennis_practice`), so scheduling, coach and reminder rules work the same for every sport.
 * Legacy football/futsal categories already follow this form.
 *
 * MET values: Adult Compendium of Physical Activities 2024 (closest activity code noted).
 * They are estimates for calorie display only; verify during content review.
 */

export type SportEventType = 'match' | 'practice';

/** Body areas as in src/domain/training/injury.ts (kept as strings so this file stays import-free). */
type Area =
  | 'ankle_foot'
  | 'calf_achilles'
  | 'knee'
  | 'hip_groin'
  | 'hamstring'
  | 'lower_back'
  | 'shoulder'
  | 'elbow_wrist_hand'
  | 'neck'
  | 'other';

const LOWER: Area[] = ['ankle_foot', 'calf_achilles', 'knee', 'hip_groin', 'hamstring'];
const ALL: Area[] = [...LOWER, 'lower_back', 'shoulder', 'elbow_wrist_hand', 'neck', 'other'];

export interface Sport {
  key: string;
  label: string;
  /** What a match and a practice are called for this sport. */
  eventLabels: Record<SportEventType, string>;
  met: Record<SportEventType, number>;
  /** An active/recovering/cleared-for-training injury here means: not ready for this sport yet. */
  loadAreas: Area[];
  /** Workout template with this sport's drills (training catalogue). */
  drillPack: string;
}

const s = (x: Sport) => x;

export const SPORTS: Sport[] = [
  s({
    key: 'football',
    label: 'Football',
    eventLabels: { match: 'Match', practice: 'Practice' },
    met: { match: 10.0, practice: 7.0 },
    loadAreas: LOWER,
    drillPack: 'futsal-skills',
  }), // soccer competitive 10.0 / general 7.0
  s({
    key: 'futsal',
    label: 'Futsal',
    eventLabels: { match: 'Match', practice: 'Practice' },
    met: { match: 10.0, practice: 7.0 },
    loadAreas: LOWER,
    drillPack: 'futsal-skills',
  }),
  s({
    key: 'basketball',
    label: 'Basketball',
    eventLabels: { match: 'Game', practice: 'Practice' },
    met: { match: 8.0, practice: 6.0 },
    loadAreas: [...LOWER, 'elbow_wrist_hand'],
    drillPack: 'basketball-skills',
  }), // game 8.0 / general 6.0
  s({
    key: 'handball',
    label: 'Handball',
    eventLabels: { match: 'Match', practice: 'Practice' },
    met: { match: 8.0, practice: 6.0 },
    loadAreas: [...LOWER, 'shoulder', 'elbow_wrist_hand'],
    drillPack: 'handball-skills',
  }), // team handball 8.0
  s({
    key: 'volleyball',
    label: 'Volleyball',
    eventLabels: { match: 'Match', practice: 'Practice' },
    met: { match: 6.0, practice: 4.0 },
    loadAreas: [...LOWER, 'shoulder', 'elbow_wrist_hand'],
    drillPack: 'volleyball-skills',
  }), // competitive gym 6.0 / non-competitive 3–4
  s({
    key: 'tennis',
    label: 'Tennis',
    eventLabels: { match: 'Match', practice: 'Practice' },
    met: { match: 8.0, practice: 6.0 },
    loadAreas: [...LOWER, 'shoulder', 'elbow_wrist_hand'],
    drillPack: 'racket-skills',
  }), // singles 8.0 / doubles 6.0
  s({
    key: 'padel',
    label: 'Padel',
    eventLabels: { match: 'Match', practice: 'Practice' },
    met: { match: 6.0, practice: 5.0 },
    loadAreas: [...LOWER, 'shoulder', 'elbow_wrist_hand'],
    drillPack: 'racket-skills',
  }), // closest: paddle tennis 6.0
  s({
    key: 'badminton',
    label: 'Badminton',
    eventLabels: { match: 'Match', practice: 'Practice' },
    met: { match: 7.0, practice: 5.5 },
    loadAreas: [...LOWER, 'shoulder', 'elbow_wrist_hand'],
    drillPack: 'racket-skills',
  }), // competitive 7.0 / social 5.5
  s({
    key: 'table_tennis',
    label: 'Table tennis',
    eventLabels: { match: 'Match', practice: 'Practice' },
    met: { match: 4.0, practice: 4.0 },
    loadAreas: ['ankle_foot', 'knee', 'shoulder', 'elbow_wrist_hand'],
    drillPack: 'racket-skills',
  }), // table tennis 4.0
  s({
    key: 'hockey',
    label: 'Hockey (ice or field)',
    eventLabels: { match: 'Game', practice: 'Practice' },
    met: { match: 8.0, practice: 7.0 },
    loadAreas: [...LOWER, 'lower_back', 'elbow_wrist_hand'],
    drillPack: 'hockey-skills',
  }), // ice general 8.0 / field 7.8
  s({
    key: 'rugby',
    label: 'Rugby',
    eventLabels: { match: 'Match', practice: 'Training' },
    met: { match: 8.3, practice: 6.3 },
    loadAreas: ALL,
    drillPack: 'rugby-skills',
  }), // union competitive 8.3 / touch 6.3
  s({
    key: 'water_polo',
    label: 'Water polo',
    eventLabels: { match: 'Match', practice: 'Practice' },
    met: { match: 10.0, practice: 7.0 },
    loadAreas: ['shoulder', 'elbow_wrist_hand', 'neck', 'lower_back', 'hip_groin', 'knee'],
    drillPack: 'swim-skills',
  }), // water polo 10.0
  s({
    key: 'martial_arts',
    label: 'Martial arts / boxing',
    eventLabels: { match: 'Bout', practice: 'Class' },
    met: { match: 10.3, practice: 5.3 },
    loadAreas: ALL,
    drillPack: 'combat-skills',
  }), // moderate pace 10.3 / slower 5.3
  s({
    key: 'swimming',
    label: 'Swimming (club)',
    eventLabels: { match: 'Race', practice: 'Training' },
    met: { match: 9.8, practice: 5.8 },
    loadAreas: ['shoulder', 'neck', 'lower_back', 'elbow_wrist_hand'],
    drillPack: 'swim-skills',
  }), // freestyle fast 9.8 / moderate 5.8
  s({
    key: 'running',
    label: 'Running club',
    eventLabels: { match: 'Race', practice: 'Club run' },
    met: { match: 9.8, practice: 8.3 },
    loadAreas: LOWER,
    drillPack: 'run-skills',
  }), // ~10 km/h 9.8 / ~8 km/h 8.3
  s({
    key: 'cycling',
    label: 'Cycling club',
    eventLabels: { match: 'Race', practice: 'Group ride' },
    met: { match: 10.0, practice: 8.0 },
    loadAreas: ['knee', 'hip_groin', 'lower_back', 'neck'],
    drillPack: 'cycle-skills',
  }), // racing 10.0 / 20–22 km/h 8.0
  s({
    key: 'other',
    label: 'Other sport',
    eventLabels: { match: 'Event', practice: 'Practice' },
    met: { match: 7.0, practice: 5.0 },
    loadAreas: ALL,
    drillPack: 'athletic-skills',
  }),
];

export const SPORT_BY_KEY: Record<string, Sport> = Object.fromEntries(
  SPORTS.map((x) => [x.key, x]),
);
export const SPORT_KEYS = SPORTS.map((x) => x.key);

/** Non-sport commitment categories (a fixed workout, run, walk or ride on the calendar). */
export const ACTIVITY_COMMITMENTS = ['workout', 'run', 'walk', 'cycle', 'other'] as const;

export const sportCategory = (key: string, type: SportEventType) => `${key}_${type}`;

/** `table_tennis_match` → { sport: table_tennis, type: match }. Null for anything else. */
export function parseSportCategory(
  category: string,
): { sport: Sport; type: SportEventType } | null {
  const m = /^([a-z_]+)_(match|practice)$/.exec(category);
  if (!m) return null;
  const sport = SPORT_BY_KEY[m[1]!];
  return sport ? { sport, type: m[2] as SportEventType } : null;
}

/** Any category ending in _match, including sports added later. */
export const isMatchCategory = (category: string) => /_match$/.test(category);
export const isSportCategory = (category: string) => /_(match|practice)$/.test(category);

/** "Basketball game", "Martial arts / boxing bout"; null if not a known sport category. */
export function sportEventLabel(category: string): string | null {
  const p = parseSportCategory(category);
  if (!p) return null;
  return `${p.sport.label} ${p.sport.eventLabels[p.type].toLowerCase()}`;
}

/** Short event noun for copy ("game", "match", "race"); "match"/"session" when unknown. */
export function eventNoun(category: string): string {
  const p = parseSportCategory(category);
  if (p) return p.sport.eventLabels[p.type].toLowerCase();
  return isMatchCategory(category) ? 'match' : 'session';
}

/** MET for a sport event, or null when the category isn't a sport event. */
export function sportMet(category: string): number | null {
  const p = parseSportCategory(category);
  if (p) return p.sport.met[p.type];
  if (isMatchCategory(category)) return SPORT_BY_KEY.other!.met.match;
  if (/_practice$/.test(category)) return SPORT_BY_KEY.other!.met.practice;
  return null;
}

/** Valid commitment category for onboarding/settings. */
export const isValidCommitmentCategory = (c: string) =>
  (ACTIVITY_COMMITMENTS as readonly string[]).includes(c) || parseSportCategory(c) !== null;

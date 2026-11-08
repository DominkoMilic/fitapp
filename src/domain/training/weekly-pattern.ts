import { type BodyArea, type InjuryLike, LOWER_BODY_AREAS, sportRestricted } from './injury';

/**
 * Weekly training pattern generator (spec 10.2), version 1.
 *
 * Decisions (see docs/decisions.md):
 * - MD-1 / MD+1 rules apply to matches (category *_match). Practices are hard days and the
 *   day after any hard commitment prefers recovery, but practices do not create MD-1 rest.
 * - Strength sessions are "moderate"; only commitments are "hard" in V1.
 */
export const WEEKLY_PATTERN_VERSION = '1.0.0';

export type CommitmentCategory =
  'futsal_match' | 'futsal_practice' | 'football_match' | 'football_practice' | 'other';

export interface Commitment {
  title: string;
  category: CommitmentCategory;
  weekday: number; // ISO 1..7
  localTime: string; // HH:mm
  durationMinutes: number;
  intensity: 'easy' | 'moderate' | 'hard';
}

export type SessionKind =
  | 'commitment'
  | 'strength_upper'
  | 'strength_lower'
  | 'strength_lower_safe'
  | 'full_body'
  | 'full_body_short'
  | 'conditioning'
  | 'recovery'
  | 'rest';

export interface DayPlan {
  weekday: number;
  kind: SessionKind;
  title: string;
  intensity: 'easy' | 'moderate' | 'hard' | 'rest';
  minutes: number;
  templateSlug: string | null;
  commitment?: Commitment;
  notes: string[];
}

export interface PatternInputs {
  trainingDaysPerWeek: number;
  preferredDays: readonly number[];
  maxSessionMinutes: number;
  commitments: readonly Commitment[];
  focusTags: readonly string[];
  injuries: readonly InjuryLike[];
}

export interface WeeklyPattern {
  version: string;
  days: DayPlan[];
  warnings: PatternWarning[];
}

export type PatternWarning =
  | 'too_many_hard_days'
  | 'fewer_sessions_than_requested'
  | 'no_training_days'
  | 'sport_while_injured';

const WEEK = [1, 2, 3, 4, 5, 6, 7] as const;
const prev = (d: number) => (d === 1 ? 7 : d - 1);
const next = (d: number) => (d === 7 ? 1 : d + 1);
const isMatch = (c: Commitment) => c.category.endsWith('_match');

const TITLES: Record<Exclude<SessionKind, 'commitment'>, string> = {
  strength_upper: 'Strength A — Upper & core',
  strength_lower: 'Strength B — Lower & core',
  strength_lower_safe: 'Strength B — Lower & core (injury-safe)',
  full_body: 'Full body strength',
  full_body_short: 'Full body 20',
  conditioning: 'Low-impact conditioning',
  recovery: 'Recovery — easy walk + mobility',
  rest: 'Rest',
};

const TEMPLATE: Record<Exclude<SessionKind, 'commitment'>, string | null> = {
  strength_upper: 'strength-a-upper',
  strength_lower: 'strength-b-lower',
  strength_lower_safe: 'strength-b-ankle-safe',
  full_body: 'full-body-45',
  full_body_short: 'full-body-20',
  conditioning: 'low-impact-conditioning',
  recovery: 'recovery',
  rest: null,
};

export function generateWeeklyPattern(input: PatternInputs): WeeklyPattern {
  const warnings: PatternWarning[] = [];
  const byDay = new Map<number, DayPlan>();
  const lowerInjury = input.injuries.find(
    (i) =>
      i.bodyArea !== null &&
      LOWER_BODY_AREAS.includes(i.bodyArea as BodyArea) &&
      i.status !== 'resolved',
  );
  const lowerBlocked = lowerInjury?.status === 'active';
  const lowerSafe = lowerInjury?.status === 'recovering';
  const restrictedSport = sportRestricted(input.injuries);

  // 1. Fixed commitments (one per day; extra commitments on the same day are merged into notes).
  for (const c of [...input.commitments].sort((a, b) => a.weekday - b.weekday)) {
    const existing = byDay.get(c.weekday);
    if (existing) {
      existing.notes.push(`Also: ${c.title}`);
      continue;
    }
    const notes: string[] = [];
    if (restrictedSport) {
      notes.push(
        'Your injury is not marked as cleared for sport. Check with a professional before playing.',
      );
    }
    byDay.set(c.weekday, {
      weekday: c.weekday,
      kind: 'commitment',
      title: c.title,
      intensity: c.intensity,
      minutes: c.durationMinutes,
      templateSlug: null,
      commitment: c,
      notes,
    });
  }
  if (restrictedSport && input.commitments.length > 0) warnings.push('sport_while_injured');

  const matchDays = input.commitments.filter(isMatch).map((c) => c.weekday);
  const hardDays = new Set(
    input.commitments.filter((c) => c.intensity === 'hard').map((c) => c.weekday),
  );
  if (hardDays.size > 4) warnings.push('too_many_hard_days');

  const mdMinus1 = new Set(matchDays.map(prev).filter((d) => !byDay.has(d)));
  const mdPlus1 = new Set(matchDays.map(next).filter((d) => !byDay.has(d) && !mdMinus1.has(d)));
  const afterHard = new Set([...hardDays].map(next).filter((d) => !byDay.has(d)));

  // 2. Candidate days for strength: not a commitment, not MD-1, not MD+1.
  const candidates = WEEK.filter((d) => !byDay.has(d) && !mdMinus1.has(d) && !mdPlus1.has(d));
  const requested = Math.max(0, Math.min(7, input.trainingDaysPerWeek));
  if (requested === 0) warnings.push('no_training_days');
  // Keep at least one full rest day: if no MD-1 rest exists, reserve one free day.
  const capacity = Math.max(0, candidates.length - (mdMinus1.size > 0 ? 0 : 1));
  const target = Math.min(requested, capacity);

  // Score: preferred days first, avoid the day after a hard commitment, keep order stable.
  const score = (d: number) =>
    (input.preferredDays.includes(d) ? 0 : 10) + (afterHard.has(d) ? 5 : 0) + d / 100;
  const chosen: number[] = [];
  for (const d of [...candidates].sort((a, b) => score(a) - score(b))) {
    if (chosen.length >= target) break;
    // Spread strength ≥ 48 h apart when possible: skip days adjacent to an already chosen day
    // on the first pass.
    if (chosen.some((c) => c === prev(d) || c === next(d))) continue;
    chosen.push(d);
  }
  for (const d of [...candidates].sort((a, b) => score(a) - score(b))) {
    if (chosen.length >= target) break;
    if (!chosen.includes(d)) chosen.push(d);
  }
  chosen.sort((a, b) => a - b);
  if (chosen.length < requested) warnings.push('fewer_sessions_than_requested');

  // 3. Assign session kinds.
  const short = input.maxSessionMinutes < 30;
  const minutes = Math.min(input.maxSessionMinutes, 45);
  const kinds = sessionKinds(chosen.length, input.focusTags, short);
  // Put lower-body work on the day furthest from the next hard day (never MD-1).
  const hardList = [...hardDays];
  const daysToNextHard = (d: number) => {
    if (hardList.length === 0) return 7;
    return Math.min(...hardList.map((h) => (h - d + 7) % 7 || 7));
  };
  const lowerIdx = kinds.indexOf('strength_lower');
  if (lowerIdx >= 0 && chosen.length > 1) {
    const best = [...chosen].sort((a, b) => daysToNextHard(b) - daysToNextHard(a) || a - b)[0];
    const bestIdx = best === undefined ? -1 : chosen.indexOf(best);
    if (bestIdx >= 0 && bestIdx !== lowerIdx) {
      const tmp = kinds[bestIdx];
      kinds[bestIdx] = 'strength_lower';
      kinds[lowerIdx] = tmp ?? 'strength_upper';
    }
  }

  chosen.forEach((day, i) => {
    let kind: SessionKind = kinds[i] ?? 'full_body';
    const notes: string[] = [];
    if (kind === 'strength_lower' && lowerBlocked) {
      kind = 'strength_upper';
      notes.push('Lower-body work replaced while your injury is active.');
    } else if (kind === 'strength_lower' && lowerSafe) {
      kind = 'strength_lower_safe';
      notes.push('Adjusted for your injury: no jumping, lateral or single-leg balance work.');
    }
    if (afterHard.has(day)) notes.push('Day after a hard session — keep the effort moderate.');
    byDay.set(day, {
      weekday: day,
      kind,
      title: TITLES[kind as Exclude<SessionKind, 'commitment'>],
      intensity: 'moderate',
      minutes: kind === 'full_body_short' ? 20 : minutes,
      templateSlug: TEMPLATE[kind as Exclude<SessionKind, 'commitment'>],
      notes,
    });
  });

  // 4. Remaining days: MD-1 rest, MD+1 / after-hard recovery, ensure ≥ 1 full rest day.
  for (const d of WEEK) {
    if (byDay.has(d)) continue;
    if (mdMinus1.has(d)) {
      byDay.set(d, restDay(d, ['Day before a match: rest, or 15 minutes of easy mobility.']));
    } else if (mdPlus1.has(d) || afterHard.has(d)) {
      byDay.set(
        d,
        recoveryDay(d, mdPlus1.has(d) ? ['Day after a match.'] : ['Day after a hard session.']),
      );
    }
  }
  const free = WEEK.filter((d) => !byDay.has(d));
  const hasRest = [...byDay.values()].some((p) => p.kind === 'rest');
  free.forEach((d, i) => {
    // Alternate rest and easy recovery on free days; guarantee at least one rest day.
    byDay.set(
      d,
      !hasRest && i === 0 ? restDay(d, []) : i % 2 === 0 ? restDay(d, []) : recoveryDay(d, []),
    );
  });
  if (![...byDay.values()].some((p) => p.kind === 'rest')) {
    // Every day is taken: turn the last recovery day into a rest day.
    const rec = [...byDay.values()].filter((p) => p.kind === 'recovery').pop();
    if (rec) byDay.set(rec.weekday, restDay(rec.weekday, rec.notes));
  }

  return {
    version: WEEKLY_PATTERN_VERSION,
    days: WEEK.map((d) => byDay.get(d) as DayPlan),
    warnings,
  };
}

function sessionKinds(count: number, focusTags: readonly string[], short: boolean): SessionKind[] {
  if (short) return Array.from({ length: count }, () => 'full_body_short');
  const cardio = focusTags.includes('cardio') || focusTags.includes('running');
  const order: SessionKind[] =
    count === 1
      ? ['full_body']
      : count === 2
        ? ['strength_upper', 'strength_lower']
        : [
            'strength_upper',
            'strength_lower',
            cardio ? 'conditioning' : 'full_body',
            'conditioning',
            'full_body',
            'conditioning',
            'full_body',
          ];
  return order.slice(0, count);
}

function restDay(weekday: number, notes: string[]): DayPlan {
  return {
    weekday,
    kind: 'rest',
    title: TITLES.rest,
    intensity: 'rest',
    minutes: 0,
    templateSlug: null,
    notes,
  };
}

function recoveryDay(weekday: number, notes: string[]): DayPlan {
  return {
    weekday,
    kind: 'recovery',
    title: TITLES.recovery,
    intensity: 'easy',
    minutes: 30,
    templateSlug: TEMPLATE.recovery,
    notes,
  };
}

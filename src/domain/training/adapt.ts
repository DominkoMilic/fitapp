/**
 * Plan adaptation after an unplanned session (2026-11-12). When you log something the plan
 * didn't have — a futsal game, a run, a long ride — PACE suggests (never applies by itself, spec 3)
 * how the next days should change:
 *
 * - The same day: a planned workout you didn't do is marked as replaced (skipped).
 * - The next day (and the day after a game): a planned session that loads the same body areas
 *   after a hard effort is swapped for one that doesn't — legs worked → upper-body strength;
 *   everything worked, or the day before a match → mobility or recovery.
 *
 * Never touched: games/matches and team practices, finished or skipped items, past days.
 * Injury and equipment changes still apply when the new workout is built. Pure; no I/O.
 */
import { addDays, type IsoDate } from '../calculations/dates';
import { isMatchCategory, isSportCategory, parseSportCategory } from '../sports/catalogue';
import { TEMPLATE_BY_SLUG } from './catalogue';

export type Stress = 'legs' | 'upper' | 'cardio';

export interface LoggedSession {
  /** Id of the session or activity row (suggestions are remembered per logged session). */
  id: string;
  date: IsoDate;
  /** Sport category (`futsal_match`), or an activity type: run, walk, cycle, other. */
  category: string;
  title: string;
  minutes: number;
  rpe: number | null;
}

export interface PlanRow {
  id: string;
  date: IsoDate;
  category: string;
  kind: string;
  status: string;
  title: string;
  templateSlug: string | null;
  intensity: string;
  minutes: number | null;
  notes: readonly string[];
}

export interface Adaptation {
  /** Stable id: `<logged id>:<row id>:<kind>`; used to remember what was applied or declined. */
  key: string;
  kind: 'skip' | 'swap';
  rowId: string;
  date: IsoDate;
  fromTitle: string;
  toTemplateSlug: string | null;
  toTitle: string | null;
  reason: string;
}

const LOWER = new Set(['ankle_foot', 'calf_achilles', 'knee', 'hip_groin', 'hamstring']);
const UPPER = new Set(['shoulder', 'elbow_wrist_hand']);

/** What a logged sport or activity loads. */
export function stressOfCategory(category: string): Stress[] {
  if (isSportCategory(category)) {
    const sport = parseSportCategory(category)?.sport;
    if (!sport || sport.key === 'other') return ['legs', 'upper', 'cardio'];
    const out: Stress[] = [];
    if (sport.loadAreas.some((a) => LOWER.has(a))) out.push('legs');
    if (sport.loadAreas.some((a) => UPPER.has(a))) out.push('upper');
    out.push('cardio');
    return out;
  }
  if (category === 'run' || category === 'cycle') return ['legs', 'cardio'];
  if (category === 'other') return ['cardio'];
  return []; // walk, workout (already a plan item), unknown
}

/** What each workout template loads. */
const TEMPLATE_STRESS: Record<string, Stress[]> = {
  'strength-a-upper': ['upper'],
  'strength-b-lower': ['legs'],
  'strength-b-ankle-safe': ['legs'],
  'full-body-45': ['legs', 'upper'],
  'full-body-20': ['legs', 'upper'],
  'low-impact-conditioning': ['legs', 'cardio'],
  recovery: [],
  'mobility-15': [],
  'futsal-skills': ['legs', 'cardio'],
  'basketball-skills': ['legs', 'cardio'],
  'handball-skills': ['legs', 'upper', 'cardio'],
  'volleyball-skills': ['legs', 'upper', 'cardio'],
  'racket-skills': ['legs', 'cardio'],
  'hockey-skills': ['legs', 'cardio'],
  'rugby-skills': ['legs', 'upper', 'cardio'],
  'swim-skills': ['upper'],
  'combat-skills': ['legs', 'upper', 'cardio'],
  'run-skills': ['legs', 'cardio'],
  'cycle-skills': ['legs'],
  'athletic-skills': ['legs', 'cardio'],
};

export function stressOfPlan(row: Pick<PlanRow, 'templateSlug' | 'category'>): Stress[] {
  if (row.templateSlug && TEMPLATE_STRESS[row.templateSlug])
    return TEMPLATE_STRESS[row.templateSlug]!;
  return stressOfCategory(row.category);
}

/** Hard enough that the next day should not load the same areas again. */
export const isHardSession = (s: LoggedSession): boolean =>
  isMatchCategory(s.category) || (s.rpe !== null && s.rpe >= 7) || s.minutes >= 45;

/** Plan items PACE may suggest changing: your own sessions, never games or team practices. */
const changeable = (r: PlanRow) =>
  r.status === 'planned' &&
  r.kind !== 'rest' &&
  r.category !== 'rest' &&
  !isSportCategory(r.category);

/** Swap targets, best first: a different area, then mobility, then recovery. */
const CANDIDATES = ['strength-a-upper', 'strength-b-lower', 'mobility-15', 'recovery'];
const EASY = new Set(['mobility-15', 'recovery']);

const AREA: Record<Stress, string> = { legs: 'legs', upper: 'upper body', cardio: 'conditioning' };
const list = (xs: string[]) =>
  xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;

export function suggestAdaptations(input: {
  logged: readonly LoggedSession[];
  plan: readonly PlanRow[];
  today: IsoDate;
  /** Keys already applied or declined. */
  handled: ReadonlySet<string>;
}): { session: LoggedSession; items: Adaptation[] } | null {
  const { plan, today } = input;
  // Newest first; only sessions from today or yesterday still change anything ahead.
  const recent = [...input.logged]
    .filter((s) => s.date >= addDays(today, -1) && s.date <= today && s.minutes >= 20)
    .sort((a, b) => b.date.localeCompare(a.date));
  for (const s of recent) {
    const items: Adaptation[] = [];
    const stress = stressOfCategory(s.category);

    // 1. The same day: the planned workout it replaced.
    for (const r of plan) {
      if (r.date !== s.date || !changeable(r) || r.date < addDays(today, -1)) continue;
      if (r.kind !== 'workout' && r.kind !== 'recovery') continue;
      items.push({
        key: `${s.id}:${r.id}:skip`,
        kind: 'skip',
        rowId: r.id,
        date: r.date,
        fromTitle: r.title,
        toTemplateSlug: null,
        toTitle: null,
        reason: `${s.title} took the place of this workout.`,
      });
    }

    // 2. The days after a hard session.
    if (isHardSession(s) && stress.length) {
      const days = isMatchCategory(s.category) ? [1, 2] : [1];
      for (const d of days) {
        const date = addDays(s.date, d);
        if (date < today) continue;
        const matchNextDay = plan.some(
          (r) =>
            r.date === addDays(date, 1) && r.status === 'planned' && isMatchCategory(r.category),
        );
        for (const r of plan) {
          if (r.date !== date || !changeable(r)) continue;
          const overlap = stressOfPlan(r).filter((x) => stress.includes(x));
          if (!overlap.length) continue;
          const to = CANDIDATES.find(
            (c) =>
              c !== r.templateSlug &&
              (!matchNextDay || EASY.has(c)) &&
              !(TEMPLATE_STRESS[c] ?? []).some((x) => stress.includes(x)),
          );
          const template = to ? TEMPLATE_BY_SLUG[to] : undefined;
          if (!template) continue;
          items.push({
            key: `${s.id}:${r.id}:swap`,
            kind: 'swap',
            rowId: r.id,
            date,
            fromTitle: r.title,
            toTemplateSlug: template.slug,
            toTitle: template.name,
            reason:
              `${r.title} works your ${list(overlap.map((x) => AREA[x]))} again right after ${s.title}` +
              (matchNextDay ? ', and you have a game the day after.' : '.') +
              ` ${EASY.has(template.slug) ? 'An easy session' : 'Training a different area'} lets them recover.`,
          });
        }
      }
    }

    const open = items.filter((i) => !input.handled.has(i.key));
    if (open.length) return { session: s, items: open };
  }
  return null;
}

// ------------------------------------------------------------------- notes on changed rows

const NOTE_PREFIX = 'pace:adapted:';

export interface AdaptedFrom {
  templateSlug: string | null;
  title: string;
  category: string;
  kind: string;
  intensity: string;
  minutes: number | null;
  /** What it was changed after, e.g. "Futsal". */
  after: string;
}

/** Machine note kept on a swapped row so the change can be undone. Hidden from the UI. */
export const adaptedNote = (from: AdaptedFrom): string => `${NOTE_PREFIX}${JSON.stringify(from)}`;

export function readAdaptedNote(notes: readonly string[]): AdaptedFrom | null {
  const raw = notes.find((n) => n.startsWith(NOTE_PREFIX));
  if (!raw) return null;
  try {
    const v = JSON.parse(raw.slice(NOTE_PREFIX.length)) as Partial<AdaptedFrom>;
    if (typeof v.title !== 'string' || typeof v.category !== 'string') return null;
    return {
      templateSlug: typeof v.templateSlug === 'string' ? v.templateSlug : null,
      title: v.title,
      category: v.category,
      kind: typeof v.kind === 'string' ? v.kind : 'workout',
      intensity: typeof v.intensity === 'string' ? v.intensity : 'moderate',
      minutes: typeof v.minutes === 'number' ? v.minutes : null,
      after: typeof v.after === 'string' ? v.after : '',
    };
  } catch {
    return null;
  }
}

/** Notes for people: machine notes left out. */
export const visibleNotes = (notes: readonly string[]): string[] =>
  notes.filter((n) => !n.startsWith(NOTE_PREFIX));

/** The row fields a swap writes. */
export function swapFields(row: PlanRow, toTemplateSlug: string, after: string) {
  const t = TEMPLATE_BY_SLUG[toTemplateSlug];
  if (!t) throw new Error('Unknown template');
  return {
    template_slug: t.slug,
    title: t.name,
    category: t.category,
    intensity: t.intensity,
    kind: t.category === 'recovery' || t.category === 'mobility' ? 'recovery' : 'workout',
    estimated_duration_minutes: t.minutes,
    is_user_modified: true,
    notes: [
      ...visibleNotes(row.notes),
      `Changed from ${row.title} after ${after}.`,
      adaptedNote({
        templateSlug: row.templateSlug,
        title: row.title,
        category: row.category,
        kind: row.kind,
        intensity: row.intensity,
        minutes: row.minutes,
        after,
      }),
    ],
  };
}

/** The row fields that undo a swap; null when the row wasn't swapped by PACE. */
export function undoFields(row: Pick<PlanRow, 'notes'>) {
  const from = readAdaptedNote(row.notes);
  if (!from) return null;
  return {
    template_slug: from.templateSlug,
    title: from.title,
    category: from.category,
    intensity: from.intensity,
    kind: from.kind,
    estimated_duration_minutes: from.minutes,
    notes: row.notes.filter(
      (n) => !n.startsWith(NOTE_PREFIX) && n !== `Changed from ${from.title} after ${from.after}.`,
    ),
  };
}

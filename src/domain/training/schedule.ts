/**
 * Turns the weekly pattern + recurring commitments into dated occurrences (spec 10.2, 10.3).
 * Occurrence keys make generation idempotent; dates and local times are calendar values, so
 * daylight-saving changes never shift a 18:00 match (spec 28.5 #5). Pure.
 */
import { addDays, isoWeekday, type IsoDate } from '@/domain/calculations/dates';
import { isMatchCategory } from '../sports/catalogue';

export const GENERATION_WEEKS = 8;

export interface PatternDayLike {
  weekday: number;
  kind: string;
  title: string;
  intensity: string;
  minutes: number;
  template_slug: string | null;
  notes: string[];
}

export interface RecurringEventLike {
  id: string;
  title: string;
  category: string;
  weekday: number;
  local_time: string;
  duration_minutes: number;
  intensity: string;
  starts_on: IsoDate;
  ends_on: IsoDate | null;
  active: boolean;
}

export interface OccurrenceRow {
  occurrence_key: string;
  training_plan_id: string | null;
  recurring_event_id: string | null;
  template_slug: string | null;
  kind: 'workout' | 'recovery' | 'rest' | 'commitment';
  title: string;
  category: string;
  intensity: 'easy' | 'moderate' | 'hard' | 'rest';
  scheduled_date: IsoDate;
  scheduled_time: string | null;
  estimated_duration_minutes: number;
  notes: string[];
}

const kindOf = (k: string): OccurrenceRow['kind'] =>
  k === 'rest' ? 'rest' : k === 'recovery' ? 'recovery' : 'workout';
const categoryOf = (k: string) =>
  k === 'conditioning' || k === 'sport_skills' || k === 'recovery' || k === 'rest' ? k : 'strength';
const intensityOf = (v: string): OccurrenceRow['intensity'] =>
  v === 'easy' || v === 'moderate' || v === 'hard' || v === 'rest' ? v : 'moderate';

export function generateOccurrences(input: {
  planId: string | null;
  planStart: IsoDate;
  pattern: readonly PatternDayLike[];
  events: readonly RecurringEventLike[];
  from: IsoDate;
  weeks?: number;
  preferredTime: string | null;
}): OccurrenceRow[] {
  const days = (input.weeks ?? GENERATION_WEEKS) * 7;
  const start = input.from > input.planStart ? input.from : input.planStart;
  const out: OccurrenceRow[] = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(start, i);
    const wd = isoWeekday(date);
    for (const e of input.events) {
      if (!e.active || e.weekday !== wd || date < e.starts_on || (e.ends_on && date > e.ends_on))
        continue;
      out.push({
        occurrence_key: `event:${e.id}:${date}`,
        training_plan_id: input.planId,
        recurring_event_id: e.id,
        template_slug: null,
        kind: 'commitment',
        title: e.title,
        category: e.category,
        intensity: intensityOf(e.intensity),
        scheduled_date: date,
        scheduled_time: e.local_time.slice(0, 5),
        estimated_duration_minutes: e.duration_minutes,
        notes: [],
      });
    }
    const day = input.pattern.find((p) => p.weekday === wd);
    if (!day || day.kind === 'commitment' || !input.planId) continue;
    out.push({
      occurrence_key: `plan:${input.planId}:${date}`,
      training_plan_id: input.planId,
      recurring_event_id: null,
      template_slug: day.template_slug,
      kind: kindOf(day.kind),
      title: day.title,
      category: categoryOf(day.kind),
      intensity: intensityOf(day.intensity),
      scheduled_date: date,
      scheduled_time: day.kind === 'rest' ? null : input.preferredTime,
      estimated_duration_minutes: day.minutes,
      notes: day.notes,
    });
  }
  return out;
}

export interface MoveWarning {
  kind: 'match_tomorrow' | 'three_hard_days';
}

/** Warnings when moving a workout to `date` (spec 10.3, 28.5 #1). Pure. */
export function moveWarnings(
  date: IsoDate,
  movingIntensity: string,
  others: readonly {
    scheduled_date: IsoDate;
    intensity: string;
    category: string;
    status: string;
  }[],
): MoveWarning[] {
  const active = others.filter((o) => o.status !== 'skipped' && o.status !== 'cancelled');
  const warnings: MoveWarning[] = [];
  const isMatch = (o: { category: string }) => isMatchCategory(o.category);
  if (
    active.some((o) => o.scheduled_date === addDays(date, 1) && isMatch(o)) &&
    movingIntensity !== 'easy'
  ) {
    warnings.push({ kind: 'match_tomorrow' });
  }
  // A third consecutive hard day only matters when the moved item is itself hard (e.g. a match).
  const hard = (d: IsoDate) => active.some((o) => o.scheduled_date === d && o.intensity === 'hard');
  if (movingIntensity === 'hard') {
    const pairs: [IsoDate, IsoDate][] = [
      [addDays(date, -2), addDays(date, -1)],
      [addDays(date, -1), addDays(date, 1)],
      [addDays(date, 1), addDays(date, 2)],
    ];
    if (pairs.some(([a, b]) => hard(a) && hard(b))) warnings.push({ kind: 'three_hard_days' });
  }
  return warnings;
}

/**
 * Milestone evaluation (spec 9, 14, 25.5). Pure: returns the milestones that should be unlocked
 * now and are not yet unlocked. Never revokes. Never rewards speed of loss or restriction.
 */
import { addDays, type IsoDate } from '@/domain/calculations/dates';
import { type DailyValue, rollingAverageAt } from '@/domain/weight/trend';

import { weightMilestones } from './weight-milestones';

export interface MilestoneDefinition {
  key: string;
  title: string;
  description: string;
  category: 'weight' | 'consistency' | 'training';
  threshold: number | null;
}

export interface MilestoneUnlock extends MilestoneDefinition {
  value: number | null;
  achievedOn: IsoDate;
}

export interface GoalLike {
  goalType: string;
  startKg: number;
  targetKg: number | null;
  secondaryKg: number | null;
}

const CONSISTENCY: MilestoneDefinition[] = [
  {
    key: 'logging_streak_7',
    title: '7-day logging streak',
    description: 'Logged something 7 days in a row',
    category: 'consistency',
    threshold: 7,
  },
  {
    key: 'logging_streak_30',
    title: '30-day logging streak',
    description: 'Logged something 30 days in a row',
    category: 'consistency',
    threshold: 30,
  },
  {
    key: 'weigh_in_30',
    title: '30 days of weigh-ins',
    description: 'Weighed in on 30 days within 45 days',
    category: 'consistency',
    threshold: 30,
  },
];

const count = (n: number, noun: string) => `${n} ${noun}${n === 1 ? '' : 's'}`;
const TRAINING: MilestoneDefinition[] = [
  ...[1, 5, 10, 25, 50, 100].map((n) => ({
    key: `workouts_${n}`,
    title: n === 1 ? 'First workout' : `${n} workouts`,
    description: `Complete ${count(n, 'workout')}`,
    category: 'training' as const,
    threshold: n,
  })),
  ...[10, 25].map((n) => ({
    key: `strength_${n}`,
    title: `${n} strength sessions`,
    description: `Complete ${n} strength sessions`,
    category: 'training' as const,
    threshold: n,
  })),
  ...[10, 25, 50, 100].map((n) => ({
    key: `training_hours_${n}`,
    title: `${n} hours of training`,
    description: `Train for ${n} hours in total`,
    category: 'training' as const,
    threshold: n,
  })),
];

/** Every milestone available for this goal, in display order (unlocked or not). */
export function milestoneCatalogue(goal: GoalLike | null): MilestoneDefinition[] {
  const weight: MilestoneDefinition[] =
    goal && goal.goalType === 'lose_weight' && goal.targetKg !== null
      ? weightMilestones({
          startKg: goal.startKg,
          targetKg: goal.targetKg,
          secondaryTargetKg: goal.secondaryKg,
        }).map((m) => ({
          key: m.key,
          title: m.title,
          description: `Your 7-day average weight reached ${m.thresholdKg.toFixed(1)} kg`,
          category: 'weight' as const,
          threshold: m.thresholdKg,
        }))
      : [];
  return [...weight, ...CONSISTENCY, ...TRAINING];
}

/** Longest run of consecutive dates (any order, duplicates ignored), with its end date. */
export function longestStreak(dates: readonly IsoDate[]): {
  length: number;
  endsOn: IsoDate | null;
} {
  const sorted = [...new Set(dates)].sort();
  let best = { length: 0, endsOn: null as IsoDate | null };
  let run = 0;
  let prev: IsoDate | null = null;
  for (const d of sorted) {
    run = prev !== null && addDays(prev, 1) === d ? run + 1 : 1;
    if (run > best.length) best = { length: run, endsOn: d };
    prev = d;
  }
  return best;
}

/** Earliest date on which `count` distinct weigh-in days fell within a `windowDays` window. */
export function firstDenseWindow(
  dates: readonly IsoDate[],
  count: number,
  windowDays: number,
): IsoDate | null {
  const sorted = [...new Set(dates)].sort();
  for (let i = count - 1; i < sorted.length; i++) {
    const end = sorted[i]!;
    const start = sorted[i - count + 1]!;
    if (start >= addDays(end, -(windowDays - 1))) return end;
  }
  return null;
}

export function evaluateMilestones(input: {
  goal: GoalLike | null;
  /** Daily weight values (all history). */
  daily: readonly DailyValue[];
  /** Local dates with any log (weight, measurement or check-in). */
  logDates: readonly IsoDate[];
  unlockedKeys: ReadonlySet<string>;
  /** Completed workout sessions and sport events (abandoned ones are excluded by the caller). */
  sessions?: readonly { date: IsoDate; durationS: number; category: string }[];
}): MilestoneUnlock[] {
  const out: MilestoneUnlock[] = [];
  const catalogue = milestoneCatalogue(input.goal);

  // Weight: first date whose 7-day average is at or below the threshold.
  const averages = input.daily
    .map((d) => ({ date: d.date, avg: rollingAverageAt(input.daily, d.date) }))
    .filter((a): a is { date: IsoDate; avg: number } => a.avg !== null);
  for (const m of catalogue.filter((c) => c.category === 'weight')) {
    if (input.unlockedKeys.has(m.key) || m.threshold === null) continue;
    const hit = averages.find((a) => a.avg <= m.threshold! + 1e-9);
    if (hit) out.push({ ...m, value: Math.round(hit.avg * 100) / 100, achievedOn: hit.date });
  }

  const streak = longestStreak(input.logDates);
  for (const key of ['logging_streak_7', 'logging_streak_30'] as const) {
    const def = catalogue.find((c) => c.key === key)!;
    if (
      !input.unlockedKeys.has(key) &&
      streak.length >= (def.threshold ?? Infinity) &&
      streak.endsOn
    ) {
      out.push({ ...def, value: streak.length, achievedOn: streak.endsOn });
    }
  }

  if (!input.unlockedKeys.has('weigh_in_30')) {
    const on = firstDenseWindow(
      input.daily.map((d) => d.date),
      30,
      45,
    );
    const def = catalogue.find((c) => c.key === 'weigh_in_30')!;
    if (on) out.push({ ...def, value: 30, achievedOn: on });
  }

  // Training: counts and hours, achieved on the session that crossed the threshold.
  const sessions = [...(input.sessions ?? [])].sort((a, b) => a.date.localeCompare(b.date));
  const crossing = (
    keyPrefix: string,
    list: typeof sessions,
    metric: (upTo: typeof sessions) => number,
  ) => {
    for (const def of catalogue.filter((c) => c.key.startsWith(keyPrefix))) {
      if (input.unlockedKeys.has(def.key) || def.threshold === null) continue;
      for (let i = 0; i < list.length; i++) {
        if (metric(list.slice(0, i + 1)) >= def.threshold) {
          out.push({ ...def, value: def.threshold, achievedOn: list[i]!.date });
          break;
        }
      }
    }
  };
  crossing('workouts_', sessions, (l) => l.length);
  crossing(
    'strength_',
    sessions.filter((s) => s.category === 'strength'),
    (l) => l.length,
  );
  crossing('training_hours_', sessions, (l) => l.reduce((a, s) => a + s.durationS, 0) / 3600);
  return out;
}

/** Spec 13.4: the goal is reached when the 7-day average is at or below the target. */
export function goalReached(
  goal: GoalLike | null,
  current: { kg: number; basis: 'average' | 'single' } | null,
): boolean {
  return (
    !!goal &&
    goal.goalType === 'lose_weight' &&
    goal.targetKg !== null &&
    !!current &&
    current.basis === 'average' &&
    current.kg <= goal.targetKg + 1e-9
  );
}

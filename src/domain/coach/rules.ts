/**
 * Daily coach (spec 15): rule-based recommendations. Pure: the caller gathers the context, `now` is
 * passed in. Each rule returns at most one card. Never diagnoses, never suggests training through
 * pain, never suggests eating less, never recommends a hard session the day before a game/match.
 */
import { addDays, dayNumber, type IsoDate } from '../calculations/dates';
import { type LoadSession, loadSpike } from './load';
import { eventNoun, isMatchCategory, sportEventLabel } from '../sports/catalogue';

export type CoachCategory = 'safety' | 'recovery' | 'training' | 'weight' | 'consistency' | 'tips';

export interface Recommendation {
  id: string;
  ruleId: RuleId;
  priority: number;
  category: CoachCategory;
  title: string;
  body: string;
  /** "Why am I seeing this?" */
  reason: string;
  action?: { label: string; href: string };
  /** Cards are daily: they expire at the end of this local date. */
  expiresOn: IsoDate;
}

export type RuleId =
  'S1' | 'S2' | 'S3' | 'R1' | 'R2' | 'R3' | 'R4' | 'R5' | 'T1' | 'T2' | 'W1' | 'C1' | 'C2';

export interface PlanItem {
  id: string;
  title: string;
  category: string;
  intensity: 'easy' | 'moderate' | 'hard';
  /** 'HH:MM' local, or null. */
  time: string | null;
  status: 'planned' | 'completed' | 'skipped' | 'moved' | string;
  /** Body areas whose restricted exercises were swapped out of this workout today. */
  adjustedFor: string[];
}

export interface DoneSession extends LoadSession {
  category: string;
  /** Intensity of the planned workout it completed, if any. */
  plannedIntensity: 'easy' | 'moderate' | 'hard' | null;
}

export interface CoachContext {
  today: IsoDate;
  /** Minutes since local midnight. */
  minuteOfDay: number;
  injuries: { area: string; status: 'active' | 'recovering' | 'resolved' | string }[];
  plan: { yesterday: PlanItem[]; today: PlanItem[]; tomorrow: PlanItem[] };
  /** Completed sessions of the last 28 days. */
  sessions: DoneSession[];
  checkin: { pain: number | null; fatigue: number | null; sleepHours: number | null } | null;
  weightGoalActive: boolean;
  lastWeighIn: IsoDate | null;
  week: { planned: number; completed: number };
  /** Distinct local days with any data (weights, check-ins, sessions…). */
  dataDays: number;
  /** Rule ids the user dismissed today. */
  dismissed: ReadonlySet<string>;
}

export const MAX_CARDS = 3;

const isMatch = isMatchCategory;
/** "Basketball game" / "Futsal match"; "Match" for unknown sports. */
const eventTitle = (category: string) => sportEventLabel(category) ?? 'Match';
const eventPhrase = (category: string) => {
  const t = eventTitle(category);
  return `${t.charAt(0).toLowerCase()}${t.slice(1)}`;
};
const hasInjury = (c: CoachContext) =>
  c.injuries.filter((i) => i.status === 'active' || i.status === 'recovering');
/** Planned items that are actual sessions (rest days stay 'planned' and never count). */
const planned = (items: PlanItem[]) =>
  items.filter((i) => i.status === 'planned' && i.category !== 'rest');
const areaList = (areas: string[]) =>
  areas.length <= 1
    ? (areas[0] ?? 'injury')
    : `${areas.slice(0, -1).join(', ')} and ${areas[areas.length - 1]}`;
const parseHm = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

/** A completed day counts as hard with RPE ≥ 7, a match, or a hard planned workout. */
const hardOn = (c: CoachContext, date: IsoDate) =>
  c.sessions.some(
    (s) =>
      s.date === date &&
      ((s.rpe !== null && s.rpe >= 7) || isMatch(s.category) || s.plannedIntensity === 'hard'),
  );

type Card = Omit<Recommendation, 'id' | 'expiresOn' | 'ruleId' | 'priority'>;
type Rule = { id: RuleId; priority: number; run: (c: CoachContext) => Card | null };

export const RULES: Rule[] = [
  {
    id: 'S1',
    priority: 0,
    run: (c) => {
      if (!hasInjury(c).length) return null;
      const areas = [...new Set(planned(c.plan.today).flatMap((p) => p.adjustedFor))];
      if (!areas.length) return null;
      return {
        category: 'safety',
        title: 'Workout adjusted',
        body: `Today's workout was adjusted for your ${areaList(areas)}. Restricted exercises were swapped.`,
        reason:
          'You have an injury marked active or recovering, and today’s workout had exercises that load it.',
        action: { label: 'See workout', href: `/training/workout/${planned(c.plan.today)[0]!.id}` },
      };
    },
  },
  {
    id: 'S2',
    priority: 0,
    run: (c) =>
      c.checkin?.pain != null && c.checkin.pain >= 4
        ? {
            category: 'safety',
            title: 'You reported pain',
            body: 'You reported pain today. Rest that area and consider professional advice if it persists.',
            reason: `Your check-in today has pain ${c.checkin.pain}/10.`,
          }
        : null,
  },
  {
    id: 'S3',
    priority: 0,
    run: (c) => {
      const injured = hasInjury(c);
      const match = [...planned(c.plan.today), ...planned(c.plan.tomorrow)].find((p) =>
        isMatch(p.category),
      );
      if (!injured.length || !match) return null;
      const when = planned(c.plan.today).includes(match) ? 'today' : 'tomorrow';
      return {
        category: 'safety',
        title: `${eventTitle(match.category)} ${when}`,
        body: `You have a ${eventPhrase(match.category)} scheduled ${when} but your ${areaList(injured.map((i) => i.area))} is marked as ${injured[0]!.status}. Check with a professional before playing.`,
        reason: `A ${eventPhrase(match.category)} is on your calendar while an injury is active or recovering.`,
      };
    },
  },
  {
    id: 'R1',
    priority: 2,
    run: (c) => {
      const m = planned(c.plan.tomorrow).find((p) => isMatch(p.category));
      return m
        ? {
            category: 'recovery',
            title: `${eventTitle(m.category)} tomorrow`,
            body: `${eventTitle(m.category)} tomorrow. Keep today light: mobility or an easy walk, drink enough and get good sleep.`,
            reason: `There is a ${eventPhrase(m.category)} on your calendar tomorrow.`,
          }
        : null;
    },
  },
  {
    id: 'R2',
    priority: 2,
    run: (c) => {
      const m =
        c.plan.yesterday.find((p) => isMatch(p.category) && p.status !== 'skipped') ??
        c.sessions.find((s) => s.date === addDays(c.today, -1) && isMatch(s.category));
      return m
        ? {
            category: 'recovery',
            title: 'Recovery day',
            body: `Recovery day after your ${eventNoun(m.category)}. An easy 20–30 min walk and mobility help.`,
            reason: `You had a ${eventPhrase(m.category)} yesterday.`,
          }
        : null;
    },
  },
  {
    id: 'R3',
    priority: 2,
    run: (c) => {
      const tired =
        (c.checkin?.fatigue != null && c.checkin.fatigue >= 4) ||
        (c.checkin?.sleepHours != null && c.checkin.sleepHours < 6);
      const hard = planned(c.plan.today).find((p) => p.intensity === 'hard');
      return tired && hard
        ? {
            category: 'recovery',
            title: "You're tired today",
            body: "You're tired today. Swap to the 20-minute version or a recovery session.",
            reason:
              'Your check-in shows high fatigue or under 6 hours of sleep, and a hard session is planned.',
            action: { label: 'Open workout', href: `/training/workout/${hard.id}` },
          }
        : null;
    },
  },
  {
    id: 'R4',
    priority: 2,
    run: (c) =>
      hardOn(c, addDays(c.today, -1)) &&
      hardOn(c, addDays(c.today, -2)) &&
      planned(c.plan.today).some((p) => p.intensity === 'hard')
        ? {
            category: 'recovery',
            title: 'Two hard days in a row',
            body: 'Two hard days in a row. Today is better as an easy day.',
            reason: 'Your last two days were hard sessions and another hard one is planned today.',
          }
        : null,
  },
  {
    id: 'R5',
    priority: 3,
    run: (c) => {
      const s = loadSpike(c.sessions, c.today);
      return s.spike
        ? {
            category: 'recovery',
            title: 'Training load jumped',
            body: 'Your training load jumped this week. Consider an easier day.',
            reason: `Your load over the last 7 days (${s.last7}) is more than 30% above your usual week (${Math.round(s.baseline ?? 0)}). Load = effort (RPE) × minutes.`,
          }
        : null;
    },
  },
  {
    id: 'T1',
    priority: 3,
    run: (c) => {
      const late = planned(c.plan.today).find(
        (p) => !isMatch(p.category) && p.time !== null && c.minuteOfDay >= parseHm(p.time) + 120,
      );
      return late
        ? {
            category: 'training',
            title: 'Short on time?',
            body: 'Short on time? The 20-minute version covers the essentials.',
            reason: `“${late.title}” was planned for ${late.time} and hasn't started yet.`,
            action: { label: 'Open workout', href: `/training/workout/${late.id}` },
          }
        : null;
    },
  },
  {
    id: 'T2',
    priority: 4,
    run: (c) => {
      const missed = planned(c.plan.yesterday).find((p) => !isMatch(p.category));
      return missed
        ? {
            category: 'training',
            title: 'Missed yesterday?',
            body: "Missed yesterday's session? Move it or skip — no problem.",
            reason: `“${missed.title}” was planned yesterday and wasn't logged.`,
            action: { label: 'Move', href: `/training/workout/${missed.id}` },
          }
        : null;
    },
  },
  {
    id: 'W1',
    priority: 5,
    run: (c) =>
      c.weightGoalActive &&
      (c.lastWeighIn === null || dayNumber(c.today) - dayNumber(c.lastWeighIn) >= 4)
        ? {
            category: 'weight',
            title: 'Morning weigh-in',
            body: 'Log a morning weigh-in to keep your trend accurate.',
            reason:
              c.lastWeighIn === null
                ? 'You have a weight goal and no weigh-ins yet.'
                : `Your last weigh-in was ${dayNumber(c.today) - dayNumber(c.lastWeighIn)} days ago.`,
            action: { label: 'Log weight', href: '/weight/log' },
          }
        : null,
  },
  {
    id: 'C1',
    priority: 6,
    run: (c) =>
      c.week.planned > 0 && c.week.completed >= c.week.planned
        ? {
            category: 'consistency',
            title: 'Great consistency',
            body: `${c.week.completed} of ${c.week.planned} workouts done this week. Great consistency.`,
            reason: "You've completed every workout planned this week.",
          }
        : null,
  },
  {
    id: 'C2',
    priority: 6,
    run: (c) =>
      c.dataDays < 3
        ? {
            category: 'tips',
            title: 'Getting started',
            body: 'Log your weight each morning and try your first workout — PACE gets smarter with a few days of data.',
            reason: "You're new here, so there isn't much data yet.",
            action: { label: 'Log weight', href: '/weight/log' },
          }
        : null,
  },
];

/** Training pushes that safety and recovery rules suppress (spec 15.1, 28.9 #1). */
const PUSHES: ReadonlySet<RuleId> = new Set(['T1', 'T2']);
const SUPPRESSORS: ReadonlySet<RuleId> = new Set(['S1', 'S2', 'S3', 'R1', 'R3', 'R4']);

/** All applicable cards, highest priority first, after suppression and dismissals; top 3 shown. */
export function evaluateCoach(c: CoachContext, limit = MAX_CARDS): Recommendation[] {
  let cards = RULES.map((r) => {
    const card = r.run(c);
    return card
      ? {
          ...card,
          id: `${r.id}:${c.today}`,
          ruleId: r.id,
          priority: r.priority,
          expiresOn: c.today,
        }
      : null;
  }).filter((x): x is Recommendation => x !== null);

  // New users get onboarding tips only (safety always stays; 28.9 #3).
  if (c.dataDays < 3) cards = cards.filter((r) => r.category === 'safety' || r.ruleId === 'C2');
  if (cards.some((r) => SUPPRESSORS.has(r.ruleId)))
    cards = cards.filter((r) => !PUSHES.has(r.ruleId));

  return cards
    .filter((r) => !c.dismissed.has(r.ruleId))
    .sort((a, b) => a.priority - b.priority || a.ruleId.localeCompare(b.ruleId))
    .slice(0, limit);
}

import { isAllowedTime, readPrefs } from '@/features/notifications/prefs';
import { addDays } from '@/domain/calculations/dates';
import { loadSpike, sessionLoadOf } from '@/domain/coach/load';
import {
  type CoachContext,
  type DoneSession,
  evaluateCoach,
  type PlanItem,
  RULES,
  type RuleId,
} from '@/domain/coach/rules';
import { consistentWeeksReached, evaluateMilestones } from '@/domain/milestones/evaluate';
import {
  applyQuietHours,
  DEFAULT_PREFS,
  NOTIFY,
  planNotifications,
  type PlanEvent,
} from '@/domain/notifications/planner';
import { weeklyReport, weekStartFor } from '@/domain/reports/weekly';

const TODAY = '2026-11-18'; // a Wednesday

describe('training load (spec 8.11)', () => {
  const week = (fromDaysAgo: number, rpe: number, minutes: number) =>
    [0, 2, 4].map((d) => ({
      date: addDays(TODAY, -(fromDaysAgo + d)),
      rpe,
      durationS: minutes * 60,
    }));
  it('session load = RPE × minutes; unrated sessions add nothing', () => {
    expect(sessionLoadOf({ date: TODAY, rpe: 7, durationS: 45 * 60 })).toBe(315);
    expect(sessionLoadOf({ date: TODAY, rpe: null, durationS: 3600 })).toBe(0);
  });
  it('spike when the last 7 days exceed 1.3 × the prior 3-week mean', () => {
    const history = [...week(21, 5, 40), ...week(14, 5, 40), ...week(7, 5, 40)];
    expect(loadSpike([...history, ...week(0, 8, 60)], TODAY).spike).toBe(true);
    expect(loadSpike([...history, ...week(0, 5, 45)], TODAY).spike).toBe(false);
  });
  it('needs 4 weeks of data', () => {
    expect(loadSpike([...week(7, 5, 40), ...week(0, 9, 90)], TODAY)).toMatchObject({
      spike: false,
      baseline: null,
    });
  });
});

// ------------------------------------------------------------------ coach rules (spec 15.2)

const item = (p: Partial<PlanItem> = {}): PlanItem => ({
  id: 'w1',
  title: 'Full body A',
  category: 'strength',
  intensity: 'moderate',
  time: null,
  status: 'planned',
  adjustedFor: [],
  ...p,
});
const session = (p: Partial<DoneSession> = {}): DoneSession => ({
  date: addDays(TODAY, -1),
  rpe: 5,
  durationS: 2700,
  category: 'strength',
  plannedIntensity: null,
  ...p,
});
const ctx = (p: Partial<CoachContext> = {}): CoachContext => ({
  today: TODAY,
  minuteOfDay: 10 * 60,
  injuries: [],
  plan: { yesterday: [], today: [], tomorrow: [] },
  sessions: [],
  checkin: null,
  weightGoalActive: false,
  lastWeighIn: TODAY,
  week: { planned: 3, completed: 1 },
  dataDays: 30,
  dismissed: new Set(),
  ...p,
});
const fires = (id: RuleId, c: CoachContext) => RULES.find((r) => r.id === id)!.run(c) !== null;

describe('coach rules: each triggers and stays quiet (spec 15.2)', () => {
  const ankle = [{ area: 'ankle', status: 'recovering' }];
  const cases: [RuleId, Partial<CoachContext>, Partial<CoachContext>][] = [
    [
      'S1',
      {
        injuries: ankle,
        plan: { yesterday: [], today: [item({ adjustedFor: ['ankle'] })], tomorrow: [] },
      },
      { injuries: ankle, plan: { yesterday: [], today: [item()], tomorrow: [] } },
    ],
    [
      'S2',
      { checkin: { pain: 4, fatigue: 2, sleepHours: 8 } },
      { checkin: { pain: 3, fatigue: 2, sleepHours: 8 } },
    ],
    [
      'S3',
      {
        injuries: ankle,
        plan: { yesterday: [], today: [], tomorrow: [item({ category: 'futsal_match' })] },
      },
      {
        injuries: [{ area: 'ankle', status: 'resolved' }],
        plan: { yesterday: [], today: [], tomorrow: [item({ category: 'futsal_match' })] },
      },
    ],
    [
      'R1',
      { plan: { yesterday: [], today: [], tomorrow: [item({ category: 'futsal_match' })] } },
      { plan: { yesterday: [], today: [], tomorrow: [item()] } },
    ],
    [
      'R2',
      { sessions: [session({ category: 'futsal_match' })] },
      { sessions: [session({ category: 'futsal_match', date: addDays(TODAY, -2) })] },
    ],
    [
      'R3',
      {
        checkin: { pain: 0, fatigue: 4, sleepHours: 7 },
        plan: { yesterday: [], today: [item({ intensity: 'hard' })], tomorrow: [] },
      },
      {
        checkin: { pain: 0, fatigue: 4, sleepHours: 7 },
        plan: { yesterday: [], today: [item({ intensity: 'easy' })], tomorrow: [] },
      },
    ],
    [
      'R4',
      {
        sessions: [session({ rpe: 8 }), session({ rpe: 7, date: addDays(TODAY, -2) })],
        plan: { yesterday: [], today: [item({ intensity: 'hard' })], tomorrow: [] },
      },
      {
        sessions: [session({ rpe: 8 }), session({ rpe: 4, date: addDays(TODAY, -2) })],
        plan: { yesterday: [], today: [item({ intensity: 'hard' })], tomorrow: [] },
      },
    ],
    [
      'R5',
      {
        sessions: [
          ...[21, 14, 7].map((d) => session({ date: addDays(TODAY, -d), rpe: 5, durationS: 3600 })),
          session({ date: TODAY, rpe: 9, durationS: 7200 }),
        ],
      },
      {
        sessions: [21, 14, 7, 0].map((d) =>
          session({ date: addDays(TODAY, -d), rpe: 5, durationS: 3600 }),
        ),
      },
    ],
    [
      'T1',
      {
        minuteOfDay: 11 * 60,
        plan: { yesterday: [], today: [item({ time: '09:00' })], tomorrow: [] },
      },
      {
        minuteOfDay: 10 * 60 + 59,
        plan: { yesterday: [], today: [item({ time: '09:00' })], tomorrow: [] },
      },
    ],
    [
      'T2',
      { plan: { yesterday: [item()], today: [], tomorrow: [] } },
      {
        plan: {
          yesterday: [item({ status: 'completed' }), item({ category: 'rest', intensity: 'easy' })],
          today: [],
          tomorrow: [],
        },
      },
    ],
    [
      'W1',
      { weightGoalActive: true, lastWeighIn: addDays(TODAY, -4) },
      { weightGoalActive: true, lastWeighIn: addDays(TODAY, -3) },
    ],
    ['C1', { week: { planned: 3, completed: 3 } }, { week: { planned: 3, completed: 2 } }],
    ['C2', { dataDays: 2 }, { dataDays: 3 }],
  ];
  it('covers all 13 rules', () => {
    expect(cases.map((c) => c[0]).sort()).toEqual(RULES.map((r) => r.id).sort());
  });
  it.each(cases)('%s triggers, and stays quiet otherwise', (id, on, off) => {
    expect(fires(id, ctx(on))).toBe(true);
    expect(fires(id, ctx(off))).toBe(false);
  });
});

describe('coach engine (spec 15.1, 28.9)', () => {
  it('#1 fatigue suppresses the training push; higher priority first', () => {
    const cards = evaluateCoach(
      ctx({
        minuteOfDay: 12 * 60,
        checkin: { pain: 0, fatigue: 5, sleepHours: 5 },
        plan: { yesterday: [], today: [item({ intensity: 'hard', time: '09:00' })], tomorrow: [] },
      }),
    );
    expect(cards.map((c) => c.ruleId)).toContain('R3');
    expect(cards.map((c) => c.ruleId)).not.toContain('T1');
  });
  it('#2 a dismissed card is hidden today and back tomorrow', () => {
    const c = ctx({ weightGoalActive: true, lastWeighIn: null });
    expect(evaluateCoach({ ...c, dismissed: new Set(['W1']) }).map((r) => r.ruleId)).not.toContain(
      'W1',
    );
    const tomorrow = evaluateCoach({ ...c, today: addDays(TODAY, 1), dismissed: new Set() });
    expect(tomorrow.map((r) => r.ruleId)).toContain('W1');
    expect(tomorrow[0]!.expiresOn).toBe(addDays(TODAY, 1));
  });
  it('#3 a new user gets onboarding tips only (and safety)', () => {
    const cards = evaluateCoach(
      ctx({
        dataDays: 1,
        minuteOfDay: 20 * 60,
        weightGoalActive: true,
        lastWeighIn: null,
      }),
    );
    expect(cards.map((c) => c.ruleId)).toEqual(['C2']);
  });
  it('#4 injury + match tomorrow → S3 and R1 (rest), never "play" advice', () => {
    const cards = evaluateCoach(
      ctx({
        injuries: [{ area: 'ankle', status: 'active' }],
        plan: { yesterday: [], today: [], tomorrow: [item({ category: 'futsal_match' })] },
      }),
    );
    expect(cards.map((c) => c.ruleId)).toEqual(['S3', 'R1']);
    for (const c of cards)
      expect(`${c.title} ${c.body}`).not.toMatch(/\bplay (on|through)|push through/i);
  });
  it('shows at most 3 cards, sorted by priority', () => {
    const cards = evaluateCoach(
      ctx({
        checkin: { pain: 6, fatigue: 2, sleepHours: 8 },
        weightGoalActive: true,
        lastWeighIn: null,
        week: { planned: 2, completed: 2 },
        plan: { yesterday: [], today: [], tomorrow: [item({ category: 'futsal_match' })] },
      }),
    );
    expect(cards).toHaveLength(3);
    expect(cards.map((c) => c.priority)).toEqual(
      [...cards.map((c) => c.priority)].sort((a, b) => a - b),
    );
    expect(cards[0]!.ruleId).toBe('S2');
  });
  it('never suggests eating less', () => {
    for (const r of RULES) {
      const card = r.run(
        ctx({
          minuteOfDay: 20 * 60,
          weightGoalActive: true,
          lastWeighIn: null,
        }),
      );
      if (card) expect(card.body).not.toMatch(/eat less|cut (calories|back)/i);
    }
  });
});

// ------------------------------------------------------------------ weekly report (spec 16, 28.8)

describe('weekly report (spec 16)', () => {
  const ws = '2026-11-09';
  const report = (p: Partial<Parameters<typeof weeklyReport>[0]> = {}) =>
    weeklyReport({
      weekStart: ws,
      today: '2026-11-20',
      daily: [],
      scheduled: [],
      sessions: [],
      activities: [],
      milestones: [],
      ...p,
    });
  it('#7 a week with no weigh-ins says no data, not zero', () => {
    const r = report();
    expect(r.weight).toMatchObject({
      startAvgKg: null,
      endAvgKg: null,
      changeKg: null,
      weighIns: 0,
    });
    expect(r.training.completionPct).toBeNull();
    expect(r.training.minutes).toBeNull();
    expect(r.activities.runKm).toBeNull();
  });
  it('#9 the current week is in progress; a finished week is not', () => {
    expect(report({ weekStart: '2026-11-16' }).inProgress).toBe(true);
    expect(report().inProgress).toBe(false);
  });
  it('sessions, load, distance (trusted only) and weight change', () => {
    const daily = Array.from({ length: 14 }, (_, i) => ({
      date: addDays('2026-11-03', i),
      kg: 108 - i * 0.1,
      count: 1,
    }));
    const r = report({
      daily,
      scheduled: [
        { date: '2026-11-10', status: 'completed', category: 'strength' },
        { date: '2026-11-12', status: 'skipped', category: 'strength' },
        { date: '2026-11-14', status: 'planned', category: 'strength' },
        { date: '2026-11-11', status: 'moved', category: 'strength' },
        { date: '2026-11-13', status: 'planned', category: 'rest' },
      ],
      sessions: [{ date: '2026-11-10', rpe: 6, durationS: 2700, category: 'strength' }],
      activities: [
        { date: '2026-11-11', type: 'run', distanceM: 5000, trusted: true },
        { date: '2026-11-12', type: 'run', distanceM: 3000, trusted: false },
      ],
    });
    expect(r.training).toMatchObject({
      planned: 2,
      completed: 1,
      completionPct: 50,
      minutes: 45,
      load: 270,
    });
    expect(r.activities).toMatchObject({ count: 2, runKm: 5 });
    expect(r.weight.changeKg).toBeLessThan(0);
    expect(r.weight.weighIns).toBe(7);
  });
  it('week starts on Monday or Sunday', () => {
    expect(weekStartFor('2026-11-18', 1)).toBe('2026-11-16');
    expect(weekStartFor('2026-11-16', 1)).toBe('2026-11-16');
    expect(weekStartFor('2026-11-18', 7)).toBe('2026-11-15');
    expect(weekStartFor('2026-11-15', 7)).toBe('2026-11-15');
  });
});

// ------------------------------------------------------------------ notifications (spec 17, 28.9)

describe('notification planner (spec 17)', () => {
  const ev = (p: Partial<PlanEvent>): PlanEvent => ({
    id: 'w',
    date: TODAY,
    time: null,
    title: 'Full body A',
    category: 'strength',
    status: 'planned',
    ...p,
  });
  const plan = (p: Partial<Parameters<typeof planNotifications>[0]> = {}) =>
    planNotifications({
      prefs: DEFAULT_PREFS,
      today: TODAY,
      nowMinute: 0,
      events: [],
      weekStartsOn: 1,
      ...p,
    });

  it('workout 60 min before its time, 09:00 without a time, never on rest days', () => {
    const out = plan({
      events: [
        ev({ id: 'a', time: '18:00' }),
        ev({ id: 'b', date: addDays(TODAY, 1) }),
        ev({ id: 'r', date: addDays(TODAY, 2), category: 'rest', title: 'Rest' }),
      ],
    });
    const workouts = out.filter((n) => n.kind === 'workout');
    expect(workouts.map((n) => [n.date, n.minute])).toEqual([
      [TODAY, 17 * 60],
      [addDays(TODAY, 1), 9 * 60],
    ]);
    expect(workouts[0]!.href).toBe('/training/workout/a');
  });
  it('match reminder the evening before at 19:00', () => {
    const out = plan({
      events: [ev({ category: 'futsal_match', date: addDays(TODAY, 2), time: '20:00' })],
    });
    expect(out.filter((n) => n.kind === 'match')).toEqual([
      expect.objectContaining({ date: addDays(TODAY, 1), minute: 19 * 60 }),
    ]);
  });
  it('#7 quiet hours: moved to 06:00 if still useful, otherwise dropped', () => {
    const n = {
      id: 'x',
      kind: 'workout' as const,
      date: TODAY,
      minute: 5 * 60 + 30,
      title: '',
      body: '',
      href: '',
    };
    expect(applyQuietHours(n, 6 * 60 + 30)?.minute).toBe(6 * 60);
    expect(applyQuietHours(n, 5 * 60 + 50)).toBeNull();
    expect(applyQuietHours({ ...n, minute: 22 * 60 }, null)).toBeNull();
    const out = plan({
      events: [ev({ time: '05:30' }), ev({ id: 'b', date: addDays(TODAY, 1), time: '06:30' })],
    });
    expect(out.filter((x) => x.kind === 'workout').map((x) => [x.date, x.minute])).toEqual([
      [addDays(TODAY, 1), 6 * 60],
    ]);
  });
  it('at most 4 per day, most important kept', () => {
    const prefs = { ...DEFAULT_PREFS, weighIn: { on: true, time: '07:30' } };
    const out = plan({
      prefs,
      events: [
        ev({ id: 'a', time: '10:00' }),
        ev({ id: 'b', time: '13:00' }),
        ev({ id: 'c', time: '17:00' }),
        ev({ id: 'm', date: addDays(TODAY, 1), category: 'futsal_match' }),
      ],
    });
    const today = out.filter((n) => n.date === TODAY);
    expect(today).toHaveLength(NOTIFY.dailyCap);
    // The match eve and workouts outrank the weigh-in, which is dropped.
    expect(today.map((n) => n.kind)).toEqual(['workout', 'workout', 'workout', 'match']);
  });
  it('#6 needs more than 64 → nearest 14 days within the limit', () => {
    const prefs = {
      ...DEFAULT_PREFS,
      weighIn: { on: true, time: '07:30' },
    };
    // Five workouts a day for 14 days plus weigh-ins: far more than the device allows.
    const events = Array.from({ length: 14 }, (_, d) =>
      ['08:00', '10:00', '12:00', '15:00', '18:00'].map((time, k) =>
        ev({ id: `${d}-${k}`, date: addDays(TODAY, d), time }),
      ),
    ).flat();
    const out = plan({ prefs, events });
    expect(out.length).toBeLessThanOrEqual(NOTIFY.maxPending);
    expect(out.every((n) => n.date <= addDays(TODAY, 13))).toBe(true);
    const dates = out.map((n) => `${n.date}:${String(n.minute).padStart(4, '0')}`);
    expect(dates).toEqual([...dates].sort());
  });
  it('nothing in the past; weekly report on the first day of the week', () => {
    const out = plan({ nowMinute: 12 * 60, events: [ev({ time: '10:00' })] });
    expect(out.some((n) => n.date === TODAY && n.minute <= 12 * 60)).toBe(false);
    expect(out.filter((n) => n.kind === 'weekly_report').map((n) => n.date)).toEqual([
      '2026-11-23',
      '2026-11-30',
    ]);
  });
  it('lock-screen text never mentions weight, kg, calories or pain', () => {
    const prefs = {
      ...DEFAULT_PREFS,
      weighIn: { on: true, time: '07:30' },
    };
    for (const n of plan({ prefs, events: [ev({ time: '18:00' })] }))
      expect(`${n.title} ${n.body}`).not.toMatch(/\d+(\.\d+)?\s?(kg|lb|kcal)|pain|injur/i);
  });
});

// ------------------------------------------------------------------ remaining milestones

describe('consistency weeks (spec 25.5)', () => {
  const weeks = (ok: boolean[]) =>
    ok.map((good, i) => ({
      weekStart: addDays('2026-08-03', i * 7),
      planned: 5,
      completed: good ? 4 : 3,
    }));
  it('needs consecutive weeks with ≥ 80% done', () => {
    expect(consistentWeeksReached(weeks([true, true, false, true, true, true, true]), 4)).toBe(
      addDays('2026-08-03', 6 * 7),
    );
    expect(consistentWeeksReached(weeks([true, true, true, false]), 4)).toBeNull();
  });
  it('weeks with nothing planned neither count nor break', () => {
    const w = weeks([true, true, true, true]);
    w.splice(2, 0, { weekStart: '2026-08-20', planned: 0, completed: 0 });
    expect(consistentWeeksReached(w, 4)).not.toBeNull();
  });
  it('unlocks once, dated the end of the reaching week', () => {
    const input = { goal: null, daily: [], logDates: [], weeks: weeks([true, true, true, true]) };
    const first = evaluateMilestones({ ...input, unlockedKeys: new Set() });
    expect(first.find((m) => m.key === 'consistency_weeks_4')?.achievedOn).toBe(
      addDays('2026-08-03', 3 * 7 + 6),
    );
    expect(
      evaluateMilestones({ ...input, unlockedKeys: new Set(['consistency_weeks_4']) }).some(
        (m) => m.key === 'consistency_weeks_4',
      ),
    ).toBe(false);
  });
});

describe('stored reminder preferences', () => {
  it('fills missing or invalid parts with defaults', () => {
    expect(readPrefs(null)).toEqual(DEFAULT_PREFS);
    const p = readPrefs({
      weighIn: { on: true, time: '07:15' },
      workout: { on: true, minutesBefore: 999 },
      // Old meal and water settings from before nutrition was removed are ignored.
      meals: { on: true, times: ['12:30'] },
    });
    expect(p.weighIn).toEqual({ on: true, time: '07:15' });
    expect('meals' in p).toBe(false);
    expect(p.workout).toEqual(DEFAULT_PREFS.workout);
  });
  it('quiet hours are not selectable', () => {
    expect(isAllowedTime('06:00')).toBe(true);
    expect(isAllowedTime('05:55')).toBe(false);
    expect(isAllowedTime('21:59')).toBe(true);
    expect(isAllowedTime('22:00')).toBe(false);
    expect(isAllowedTime('05:59')).toBe(false);
  });
});

import { addDays } from '@/domain/calculations/dates';
import { evaluateMilestones } from '@/domain/milestones/evaluate';
import { EXERCISE_BY_SLUG, TEMPLATE_BY_SLUG } from '@/domain/training/catalogue';
import { restrictionTagsFor } from '@/domain/training/injury';
import { suggestProgression } from '@/domain/training/progression';
import { personalRecords, weekStartOf } from '@/domain/training/records';
import { generateOccurrences, moveWarnings } from '@/domain/training/schedule';
import {
  activeSeconds,
  completionStatus,
  estimateCalories,
  sessionLoad,
  sessionMet,
  sessionVolumeKg,
} from '@/domain/training/session';
import { buildWorkout, equipmentSatisfied } from '@/domain/training/workout-builder';

const SEED_EQUIPMENT = new Set(['dumbbells', 'kettlebell', 'exercise_mat']);

describe('equipment matching', () => {
  it('requires every item; "a|b" means either', () => {
    expect(equipmentSatisfied([], new Set())).toBe(true);
    expect(equipmentSatisfied(['dumbbells|kettlebell'], new Set(['kettlebell']))).toBe(true);
    expect(equipmentSatisfied(['bench', 'dumbbells|kettlebell'], new Set(['dumbbells']))).toBe(
      false,
    );
  });
});

describe('workout builder (spec 9.2, 28.5 #13–14)', () => {
  const build = (
    slug: string,
    restrictions: ReturnType<typeof restrictionTagsFor>,
    owned = SEED_EQUIPMENT,
  ) =>
    buildWorkout({
      template: TEMPLATE_BY_SLUG[slug]!,
      exercisesBySlug: EXERCISE_BY_SLUG,
      restrictions,
      ownedEquipment: owned,
    });

  it('without restrictions keeps Strength B as written', () => {
    const w = build('strength-b-lower', []);
    expect(w.exercises.map((e) => e.slug)).toContain('reverse-lunge');
    expect(w.adjustedForInjury).toBe(false);
  });
  it('a recovering ankle swaps lunges and standing calf raises for safe alternatives', () => {
    const w = build(
      'strength-b-lower',
      restrictionTagsFor({ bodyArea: 'ankle_foot', status: 'recovering' }),
    );
    const slugs = w.exercises.map((e) => e.slug);
    expect(slugs).not.toContain('reverse-lunge');
    expect(slugs).not.toContain('standing-calf-raise');
    expect(slugs).toContain('single-leg-glute-bridge');
    expect(slugs).toContain('seated-calf-raise');
    expect(w.adjustedForInjury).toBe(true);
    const restricted = restrictionTagsFor({ bodyArea: 'ankle_foot', status: 'recovering' });
    for (const e of w.exercises) {
      expect(
        EXERCISE_BY_SLUG[e.slug]!.contraindications.some((t) => restricted.includes(t as never)),
      ).toBe(false);
    }
  });
  it('no equipment → bodyweight alternatives (spec 28.2 #11)', () => {
    const w = build('strength-a-upper', [], new Set());
    const slugs = w.exercises.map((e) => e.slug);
    expect(slugs).toContain('push-up'); // floor press → push-up
    expect(w.removed.map((r) => r.reason)).toContain('equipment');
    for (const e of w.exercises) expect(EXERCISE_BY_SLUG[e.slug]!.equipment).toEqual([]);
  });
  it('flags too few exercises (wrist + shoulder injuries on an upper day, no equipment)', () => {
    const r = [
      ...restrictionTagsFor({ bodyArea: 'elbow_wrist_hand', status: 'active' }),
      ...restrictionTagsFor({ bodyArea: 'shoulder', status: 'active' }),
    ];
    const w = build('strength-a-upper', r, new Set());
    expect(w.tooFewExercises).toBe(true);
  });
  it('substitutes keep their own defaults (time vs reps)', () => {
    const w = build(
      'full-body-20',
      restrictionTagsFor({ bodyArea: 'elbow_wrist_hand', status: 'active' }),
    );
    const plankSub = w.exercises.find((e) => e.substitutedFor === 'plank');
    expect(plankSub?.slug).toBe('dead-bug');
    expect(plankSub?.repsMin).not.toBeNull();
    expect(plankSub?.durationS).toBeNull();
  });
  it('an alternative already in the workout drops the original and reports it', () => {
    const w = build(
      'strength-a-upper',
      restrictionTagsFor({ bodyArea: 'elbow_wrist_hand', status: 'active' }),
    );
    expect(w.exercises.filter((e) => e.slug === 'dead-bug' && e.phase === 'main')).toHaveLength(1);
    expect(w.removed.map((r) => r.slug)).toContain('plank');
  });
});

describe('schedule generation (spec 10.2, 28.5 #4–5)', () => {
  const pattern = [
    {
      weekday: 1,
      kind: 'strength_upper',
      title: 'Strength A',
      intensity: 'moderate',
      minutes: 45,
      template_slug: 'strength-a-upper',
      notes: [],
    },
    {
      weekday: 2,
      kind: 'commitment',
      title: 'Practice',
      intensity: 'hard',
      minutes: 60,
      template_slug: null,
      notes: [],
    },
    {
      weekday: 5,
      kind: 'rest',
      title: 'Rest',
      intensity: 'rest',
      minutes: 0,
      template_slug: null,
      notes: [],
    },
  ];
  const events = [
    {
      id: 'ev1',
      title: 'Practice',
      category: 'futsal_practice',
      weekday: 2,
      local_time: '20:00:00',
      duration_minutes: 60,
      intensity: 'hard',
      starts_on: '2026-11-01',
      ends_on: null,
      active: true,
    },
  ];
  const gen = () =>
    generateOccurrences({
      planId: 'p1',
      planStart: '2026-11-08',
      pattern,
      events,
      from: '2026-11-09',
      weeks: 8,
      preferredTime: '18:00',
    });

  it('creates 8 weeks of keyed occurrences; commitments come from events only', () => {
    const rows = gen();
    expect(rows.filter((r) => r.kind === 'commitment')).toHaveLength(8);
    expect(rows.filter((r) => r.title === 'Strength A')).toHaveLength(8);
    expect(rows.filter((r) => r.kind === 'rest')).toHaveLength(8);
    expect(new Set(rows.map((r) => r.occurrence_key)).size).toBe(rows.length);
  });
  it('is deterministic (same keys every run → idempotent upserts)', () => {
    expect(gen().map((r) => r.occurrence_key)).toEqual(gen().map((r) => r.occurrence_key));
  });
  it('keeps 20:00 local across the DST change in late March', () => {
    const rows = generateOccurrences({
      planId: 'p1',
      planStart: '2027-03-15',
      pattern,
      events,
      from: '2027-03-15',
      weeks: 3,
      preferredTime: null,
    });
    expect(rows.filter((r) => r.kind === 'commitment').map((r) => r.scheduled_time)).toEqual([
      '20:00',
      '20:00',
      '20:00',
    ]);
  });
  it('respects series start and end dates', () => {
    const rows = generateOccurrences({
      planId: 'p1',
      planStart: '2026-11-08',
      pattern: [],
      from: '2026-11-09',
      weeks: 4,
      preferredTime: null,
      events: [{ ...events[0]!, starts_on: '2026-11-17', ends_on: '2026-11-24' }],
    });
    expect(rows.map((r) => r.scheduled_date)).toEqual(['2026-11-17', '2026-11-24']);
  });
  it('warns when moving onto the day before a match', () => {
    const others = [
      {
        scheduled_date: '2026-11-14',
        intensity: 'hard',
        category: 'futsal_match',
        status: 'planned',
      },
    ];
    expect(moveWarnings('2026-11-13', 'moderate', others)).toEqual([{ kind: 'match_tomorrow' }]);
    expect(moveWarnings('2026-11-13', 'easy', others)).toEqual([]);
    expect(moveWarnings('2026-11-12', 'moderate', others)).toEqual([]);
  });
  it('warns about a third hard day in a row', () => {
    const others = [
      {
        scheduled_date: '2026-11-10',
        intensity: 'hard',
        category: 'futsal_practice',
        status: 'planned',
      },
      { scheduled_date: '2026-11-11', intensity: 'hard', category: 'other', status: 'planned' },
    ];
    expect(moveWarnings('2026-11-12', 'hard', others)).toEqual([{ kind: 'three_hard_days' }]);
  });
});

describe('session maths', () => {
  it('N10 volume: 3 × 12 × 5 kg = 180 kg; bodyweight adds nothing', () => {
    const sets = Array.from({ length: 3 }, () => ({
      repetitions: 12,
      weight_kg: 5,
      duration_seconds: null,
      completed: true,
    }));
    expect(
      sessionVolumeKg([
        ...sets,
        { repetitions: 15, weight_kg: null, duration_seconds: null, completed: true },
      ]),
    ).toBe(180);
    expect(
      sessionVolumeKg([
        { repetitions: 12, weight_kg: '5.00', duration_seconds: null, completed: false },
      ]),
    ).toBe(0);
  });
  it('status: no completed sets → abandoned (spec 28.5 #9)', () => {
    expect(completionStatus([], 10)).toBe('abandoned');
    expect(
      completionStatus(
        [{ repetitions: 10, weight_kg: null, duration_seconds: null, completed: true }],
        20,
      ),
    ).toBe('partial');
    expect(
      completionStatus(
        Array(12).fill({
          repetitions: 10,
          weight_kg: null,
          duration_seconds: null,
          completed: true,
        }),
        20,
      ),
    ).toBe('completed');
  });
  it('active time excludes pauses', () =>
    expect(activeSeconds(0, 50 * 60_000, 5 * 60_000)).toBe(2700));
  it('calories: G7-style MET × kg × hours, labelled estimate', () => {
    expect(
      estimateCalories(sessionMet({ category: 'strength', intensity: 'moderate' }), 108, 2700),
    ).toBe(284);
    expect(sessionMet({ category: 'futsal_match', intensity: 'hard' })).toBe(10);
    expect(sessionMet({ category: 'futsal_practice', intensity: 'hard' })).toBe(7);
  });
  it('training load = RPE × minutes', () => {
    expect(sessionLoad(7, 3600)).toBe(420);
    expect(sessionLoad(null, 3600)).toBeNull();
  });
});

describe('progression (spec 10.5)', () => {
  const base = {
    sets: Array.from({ length: 3 }, () => ({ reps: 15, weightKg: 5, completed: true })),
    repsMax: 15,
    plannedSets: 3,
    rpe: 7,
    restS: 60,
    unilateral: false,
    veryHardStreak: 0,
    heavierWeightAvailableKg: null,
  };
  it('adds reps first (5 kg dumbbells)', () =>
    expect(suggestProgression(base)).toMatchObject({ kind: 'more_reps', targetReps: 17 }));
  it('suggests heavier weight when available', () =>
    expect(suggestProgression({ ...base, heavierWeightAvailableKg: 7.5 })).toMatchObject({
      kind: 'heavier',
      weightKg: 7.5,
    }));
  it('repeats when targets were missed or it felt too hard', () => {
    expect(
      suggestProgression({
        ...base,
        sets: [{ reps: 12, weightKg: 5, completed: true }, ...base.sets.slice(1)],
      }).kind,
    ).toBe('repeat');
    expect(suggestProgression({ ...base, rpe: 9 }).kind).toBe('repeat');
    expect(suggestProgression({ ...base, veryHardStreak: 2 }).kind).toBe('repeat');
  });
  it('then tempo, extra set, shorter rest', () => {
    const at20 = { ...base, sets: base.sets.map((s) => ({ ...s, reps: 20 })), repsMax: 20 };
    expect(suggestProgression(at20).kind).toBe('tempo');
    expect(suggestProgression({ ...at20, unilateral: true }).kind).toBe('extra_set');
    expect(
      suggestProgression({
        ...at20,
        unilateral: true,
        plannedSets: 4,
        sets: [...at20.sets, at20.sets[0]!],
      }),
    ).toMatchObject({ kind: 'less_rest', restS: 45 });
  });
});

describe('personal records (spec 14.3)', () => {
  const set = (over: object) => ({
    sessionId: 's1',
    date: '2026-11-10',
    exerciseSlug: 'push-up',
    exerciseName: 'Push-up',
    reps: 10,
    weightKg: null,
    durationS: null,
    completed: true,
    ...over,
  });
  it('push-ups, plank, strength and week minutes', () => {
    const prs = personalRecords(
      [
        set({ reps: 12 }),
        set({ reps: 18, date: '2026-11-17' }),
        set({ reps: 30, completed: false }),
        set({ exerciseSlug: 'plank', exerciseName: 'Plank', reps: null, durationS: 65 }),
        set({ exerciseSlug: 'goblet-squat', exerciseName: 'Goblet squat', reps: 15, weightKg: 5 }),
        set({
          exerciseSlug: 'goblet-squat',
          exerciseName: 'Goblet squat',
          reps: 10,
          weightKg: 7.5,
        }),
      ],
      [
        {
          id: 's1',
          date: '2026-11-10',
          weekStart: '2026-11-09',
          durationS: 2700,
          completion: 'completed',
        },
        {
          id: 's2',
          date: '2026-11-12',
          weekStart: '2026-11-09',
          durationS: 1800,
          completion: 'completed',
        },
        {
          id: 's3',
          date: '2026-11-13',
          weekStart: '2026-11-09',
          durationS: 9000,
          completion: 'abandoned',
        },
      ],
    );
    const by = Object.fromEntries(prs.map((p) => [p.key, p]));
    expect(by['max_reps:push-up']).toMatchObject({ value: 18, date: '2026-11-17' });
    expect(by['longest:plank']?.value).toBe(65);
    expect(by['strength:goblet-squat']).toMatchObject({ value: 10, detail: '7.5 kg' });
    expect(by.week_minutes?.value).toBe(75);
  });
  it('week starts on Monday by default', () => {
    expect(weekStartOf('2026-11-08')).toBe('2026-11-02'); // Sunday → previous Monday
    expect(weekStartOf('2026-11-09')).toBe('2026-11-09');
    expect(weekStartOf('2026-11-08', 7)).toBe('2026-11-08');
  });
});

describe('training milestones', () => {
  it('first workout, 5 workouts, and hours, achieved on the crossing session', () => {
    const sessions = Array.from({ length: 5 }, (_, i) => ({
      date: addDays('2026-11-09', i * 2),
      durationS: 2700,
      category: 'strength',
    }));
    const u = evaluateMilestones({
      goal: null,
      daily: [],
      logDates: [],
      unlockedKeys: new Set(),
      sessions,
    });
    const by = Object.fromEntries(u.map((m) => [m.key, m.achievedOn]));
    expect(by.workouts_1).toBe('2026-11-09');
    expect(by.workouts_5).toBe('2026-11-17');
    expect(by.workouts_10).toBeUndefined();
    expect(by.training_hours_10).toBeUndefined(); // 3.75 h
  });
});

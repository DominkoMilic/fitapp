import {
  addExercise,
  removeExercise,
  removeSet,
  summarize,
  type ActiveWorkout,
} from '@/domain/training/active-workout';
import {
  activeFromSaved,
  emptyWorkout,
  groupSavedSets,
  manualTiming,
  markAllDone,
} from '@/domain/training/workout-log';

const pushUp = {
  slug: 'push-up',
  name: 'Push-up',
  tracking: 'reps' as const,
  unilateral: false,
  defaultSets: 3,
  repsMin: 6,
  repsMax: 12,
  durationS: null,
};
const plank = {
  ...pushUp,
  slug: 'plank',
  name: 'Plank',
  tracking: 'time' as const,
  repsMin: null,
  repsMax: null,
  durationS: 40,
};

const base = (): ActiveWorkout => ({
  ...emptyWorkout({ id: 'w1', userId: 'u1', title: 'Strength A', startedAt: 0 }),
  exercises: [
    {
      slug: 'goblet-squat',
      name: 'Goblet squat',
      phase: 'main',
      tracking: 'reps_weight',
      targetSets: 2,
      repsMin: 10,
      repsMax: 12,
      durationS: null,
      restS: 60,
      unilateral: false,
      skipped: false,
      painFlag: false,
      sets: [
        { reps: 12, weightKg: 5, durationS: null, completed: true },
        { reps: 12, weightKg: 5, durationS: null, completed: false },
      ],
    },
  ],
});

describe('adding work the plan did not include', () => {
  it('adds push-ups after the current exercise and moves to them', () => {
    const w = addExercise(base(), pushUp, {});
    expect(w.exercises.map((e) => e.slug)).toEqual(['goblet-squat', 'push-up']);
    expect(w.currentIndex).toBe(1);
    expect(w.exercises[1]).toMatchObject({ added: true, targetSets: 0 });
    expect(w.exercises[1]!.sets).toHaveLength(3);
    expect(w.exercises[1]!.sets[0]).toEqual({
      reps: 12,
      weightKg: null,
      durationS: null,
      completed: false,
    });
  });
  it('pre-fills from the last time and handles timed exercises', () => {
    const w = addExercise(base(), pushUp, {
      'push-up': [{ reps: 15, weightKg: null, durationS: null }],
    });
    expect(w.exercises[1]!.sets).toEqual([
      { reps: 15, weightKg: null, durationS: null, completed: false },
    ]);
    const p = addExercise(base(), plank, {});
    expect(p.exercises[1]!.sets[0]).toMatchObject({ reps: null, durationS: 40 });
  });
  it('added work never lowers the completion rate', () => {
    const plain = summarize(base(), 1000);
    let w = addExercise(base(), pushUp, {});
    w = {
      ...w,
      exercises: w.exercises.map((e, i) =>
        i === 1 ? { ...e, sets: e.sets.map((s) => ({ ...s, completed: true })) } : e,
      ),
    };
    const more = summarize(w, 1000);
    expect(more.plannedSets).toBe(plain.plannedSets);
    expect(more.setsDone).toBe(plain.setsDone + 3);
  });
  it('removes sets and exercises, keeping at least one', () => {
    let w = removeSet(base(), 0, 1);
    expect(w.exercises[0]!.sets).toHaveLength(1);
    w = removeSet(w, 0, 0);
    expect(w.exercises[0]!.sets).toHaveLength(1);
    const two = addExercise(base(), pushUp, {});
    expect(removeExercise(two, 1).exercises.map((e) => e.slug)).toEqual(['goblet-squat']);
    expect(removeExercise(base(), 0).exercises).toHaveLength(1);
  });
});

describe('manual timing', () => {
  const now = Date.parse('2026-11-09T20:00:00Z');
  const ok = (over = {}) =>
    manualTiming({
      date: '2026-11-09',
      startTime: '18:00',
      durationMinutes: 45,
      timezone: 'Europe/Zagreb',
      now,
      today: '2026-11-09',
      ...over,
    });
  it('turns a local date, start time and minutes into exact times', () => {
    const r = ok();
    expect(r.ok && new Date(r.value.startedAt).toISOString()).toBe('2026-11-09T17:00:00.000Z');
    expect(r.ok && r.value.durationS).toBe(2700);
  });
  it('rejects bad input, future and very old workouts', () => {
    expect(ok({ startTime: '25:00' })).toEqual({ ok: false, error: 'time' });
    expect(ok({ durationMinutes: 0 })).toEqual({ ok: false, error: 'duration' });
    expect(ok({ durationMinutes: 400 })).toEqual({ ok: false, error: 'duration' });
    expect(ok({ startTime: '23:30' })).toEqual({ ok: false, error: 'future' });
    // 20:30 local + 45 min ends at 21:15 local, after "now" (21:00 local).
    expect(ok({ startTime: '20:30' })).toEqual({ ok: false, error: 'future' });
    expect(ok({ startTime: '20:10', durationMinutes: 50 }).ok).toBe(true);
    expect(ok({ date: '2026-08-01' })).toEqual({ ok: false, error: 'too_old' });
  });
});

describe('saved sessions', () => {
  const row = (id: string, slug: string, n: number, t: string, over = {}) => ({
    id,
    exercise_slug: slug,
    exercise_name: slug,
    set_number: n,
    repetitions: 10,
    weight_kg: null,
    duration_seconds: null,
    completed: true,
    skipped: false,
    pain_flag: false,
    created_at: t,
    ...over,
  });
  const rows = [
    row('a', 'glute-bridge', 1, '2026-11-09T10:00:01Z'),
    row('b', 'goblet-squat', 1, '2026-11-09T10:00:02Z', { weight_kg: '8' }),
    row('c', 'goblet-squat', 2, '2026-11-09T10:00:03Z', { weight_kg: '8', completed: false }),
    row('d', 'glute-bridge', 1, '2026-11-09T10:00:04Z'),
    row('e', 'glute-bridge', 2, '2026-11-09T10:00:05Z'),
  ];
  it('keeps the warm-up and main glute bridges as separate groups', () => {
    expect(groupSavedSets([...rows].reverse()).map((g) => [g.slug, g.rows.length])).toEqual([
      ['glute-bridge', 1],
      ['goblet-squat', 2],
      ['glute-bridge', 2],
    ]);
  });
  it('becomes an editable workout with the right tracking', () => {
    const w = activeFromSaved({
      session: {
        id: 's1',
        user_id: 'u1',
        scheduled_workout_id: null,
        template_slug: 'strength-b-lower',
        title: 'Strength B',
        category: 'strength',
        started_at: '2026-11-09T09:00:00Z',
        notes: null,
      },
      sets: rows,
      exercisesBySlug: { 'goblet-squat': { tracking: 'reps_weight', unilateral: false } },
    });
    expect(w.exercises.map((e) => e.tracking)).toEqual(['reps', 'reps_weight', 'reps']);
    expect(w.exercises[1]!.sets).toEqual([
      { reps: 10, weightKg: 8, durationS: null, completed: true },
      { reps: 10, weightKg: 8, durationS: null, completed: false },
    ]);
  });
  it('"I already did this" ticks every set', () => {
    expect(markAllDone(base()).exercises[0]!.sets.every((s) => s.completed)).toBe(true);
  });
});

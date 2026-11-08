import {
  addSet,
  createActiveWorkout,
  elapsedS,
  pause,
  reportPain,
  restRemainingS,
  resume,
  setsForSave,
  skipExercise,
  summarize,
  toggleSetDone,
  updateSet,
} from '@/domain/training/active-workout';
import { EXERCISE_BY_SLUG, TEMPLATE_BY_SLUG } from '@/domain/training/catalogue';
import { buildWorkout } from '@/domain/training/workout-builder';

const T0 = 1_700_000_000_000;
const built = buildWorkout({
  template: TEMPLATE_BY_SLUG['full-body-20']!,
  exercisesBySlug: EXERCISE_BY_SLUG,
  restrictions: [],
  ownedEquipment: new Set(['dumbbells']),
});
const make = (lastSets = {}) =>
  createActiveWorkout({
    id: 'w1',
    userId: 'u1',
    scheduledId: 's1',
    built,
    category: 'strength',
    intensity: 'moderate',
    now: T0,
    lastSets,
  });
const idx = (w: ReturnType<typeof make>, slug: string) =>
  w.exercises.findIndex((e) => e.slug === slug);

describe('active workout', () => {
  it('pre-fills sets from the last session (spec 10.4)', () => {
    const w = make({ 'goblet-squat': [{ reps: 14, weightKg: 5, durationS: null }] });
    const squat = w.exercises[idx(w, 'goblet-squat')]!;
    expect(squat.sets).toHaveLength(2);
    expect(squat.sets.every((s) => s.reps === 14 && s.weightKg === 5)).toBe(true);
    const plank = w.exercises[idx(w, 'plank')]!;
    expect(plank.sets[0]).toMatchObject({ reps: null, durationS: 30, weightKg: null });
  });

  it('rest timer uses an absolute end time (survives backgrounding)', () => {
    let w = make();
    const i = idx(w, 'goblet-squat');
    w = toggleSetDone(w, i, 0, T0 + 60_000);
    expect(restRemainingS(w, T0 + 60_000)).toBe(45);
    expect(restRemainingS(w, T0 + 60_000 + 30_000)).toBe(15); // app was in background 30 s
    expect(restRemainingS(w, T0 + 60_000 + 90_000)).toBe(0);
    w = toggleSetDone(w, i, 1, T0 + 120_000); // last set: no rest
    expect(w.restEndsAt).toBeNull();
  });

  it('pauses are excluded from the duration', () => {
    let w = make();
    w = pause(w, T0 + 10 * 60_000);
    expect(elapsedS(w, T0 + 30 * 60_000)).toBe(600); // frozen while paused
    w = resume(w, T0 + 15 * 60_000);
    expect(elapsedS(w, T0 + 25 * 60_000)).toBe(20 * 60);
  });

  it('summary: volume, sets, status; abandoned without completed sets (spec 28.5 #9)', () => {
    let w = make();
    expect(summarize(w, T0 + 60_000).status).toBe('abandoned');
    const i = idx(w, 'goblet-squat');
    w = updateSet(w, i, 0, { reps: 15, weightKg: 5 });
    w = updateSet(w, i, 1, { reps: 12, weightKg: 5 });
    w = toggleSetDone(w, i, 0, T0);
    w = toggleSetDone(w, i, 1, T0);
    const s = summarize(w, T0 + 20 * 60_000);
    expect(s.volumeKg).toBe(135);
    expect(s.setsDone).toBe(2);
    expect(s.exercisesDone).toBe(1);
    expect(s.status).toBe('partial');
    expect(s.durationS).toBe(1200);
  });

  it('flags workouts longer than 4 hours', () => {
    expect(summarize(make(), T0 + 5 * 3600_000).suspiciouslyLong).toBe(true);
  });

  it('skip and pain end the exercise; pain is saved on the sets', () => {
    let w = make();
    const i = idx(w, 'goblet-squat');
    w = skipExercise(w, i);
    expect(w.exercises[i]!.skipped).toBe(true);
    expect(w.currentIndex).toBe(i + 1);
    const j = idx(w, 'push-up');
    w = toggleSetDone(w, j, 0, T0);
    w = reportPain(w, j);
    expect(w.exercises[j]!.painFlag).toBe(true);
    expect(w.restEndsAt).toBeNull();
    expect(summarize(w, T0 + 1000).painReported).toBe(true);
    const rows = setsForSave(w);
    expect(rows.filter((r) => r.exerciseSlug === 'push-up').every((r) => r.painFlag)).toBe(true);
    expect(rows.filter((r) => r.exerciseSlug === 'goblet-squat').every((r) => r.skipped)).toBe(
      true,
    );
  });

  it('can add sets (max 10)', () => {
    let w = make();
    const i = idx(w, 'glute-bridge');
    for (let k = 0; k < 20; k++) w = addSet(w, i);
    expect(w.exercises[i]!.sets).toHaveLength(10);
  });

  it('save rows keep only the fields that match the tracking type', () => {
    const w = make({ plank: [{ reps: 5, weightKg: 3, durationS: 45 }] });
    const plankRows = setsForSave(w).filter((r) => r.exerciseSlug === 'plank');
    expect(plankRows[0]).toMatchObject({ reps: null, weightKg: null, durationS: 45 });
  });
});

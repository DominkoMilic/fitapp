/** Personal records derived from history (spec 14.3). Pure; deleting history recalculates them. */
export interface RecordSet {
  sessionId: string;
  date: string;
  exerciseSlug: string | null;
  exerciseName: string;
  reps: number | null;
  weightKg: number | null;
  durationS: number | null;
  completed: boolean;
}

export interface RecordSession {
  id: string;
  date: string;
  weekStart: string;
  durationS: number;
  completion: string;
}

export interface PersonalRecord {
  key: string;
  title: string;
  value: number;
  unit: 'reps' | 'seconds' | 'minutes' | 'kg';
  date: string;
  detail: string | null;
}

const PUSH_UP_SLUGS = new Set(['push-up', 'incline-push-up']);
const PLANK_SLUGS = new Set(['plank', 'side-plank']);

function best<T>(items: readonly T[], score: (t: T) => number): T | null {
  let top: T | null = null;
  for (const i of items) if (score(i) > 0 && (!top || score(i) > score(top))) top = i;
  return top;
}

export function personalRecords(
  sets: readonly RecordSet[],
  sessions: readonly RecordSession[],
): PersonalRecord[] {
  const done = sets.filter((s) => s.completed);
  const out: PersonalRecord[] = [];

  for (const slug of PUSH_UP_SLUGS) {
    const top = best(
      done.filter((s) => s.exerciseSlug === slug),
      (s) => s.reps ?? 0,
    );
    if (top)
      out.push({
        key: `max_reps:${slug}`,
        title: `${top.exerciseName}: most reps in a set`,
        value: top.reps!,
        unit: 'reps',
        date: top.date,
        detail: null,
      });
  }
  for (const slug of PLANK_SLUGS) {
    const top = best(
      done.filter((s) => s.exerciseSlug === slug),
      (s) => s.durationS ?? 0,
    );
    if (top)
      out.push({
        key: `longest:${slug}`,
        title: `${top.exerciseName}: longest hold`,
        value: top.durationS!,
        unit: 'seconds',
        date: top.date,
        detail: null,
      });
  }

  // Strength: best reps at the heaviest weight used, per exercise.
  const bySlug = new Map<string, RecordSet[]>();
  for (const s of done)
    if (s.exerciseSlug && (s.weightKg ?? 0) > 0)
      bySlug.set(s.exerciseSlug, [...(bySlug.get(s.exerciseSlug) ?? []), s]);
  for (const [slug, list] of bySlug) {
    const maxW = Math.max(...list.map((s) => s.weightKg ?? 0));
    const top = best(
      list.filter((s) => s.weightKg === maxW),
      (s) => s.reps ?? 0,
    );
    if (top)
      out.push({
        key: `strength:${slug}`,
        title: `${top.exerciseName}: best at ${maxW} kg`,
        value: top.reps!,
        unit: 'reps',
        date: top.date,
        detail: `${maxW} kg`,
      });
  }

  // Most workout minutes in a week.
  const weeks = new Map<string, number>();
  for (const s of sessions)
    if (s.completion !== 'abandoned')
      weeks.set(s.weekStart, (weeks.get(s.weekStart) ?? 0) + s.durationS);
  const topWeek = [...weeks.entries()].sort((a, b) => b[1] - a[1])[0];
  if (topWeek && topWeek[1] > 0) {
    out.push({
      key: 'week_minutes',
      title: 'Most workout minutes in a week',
      value: Math.round(topWeek[1] / 60),
      unit: 'minutes',
      date: topWeek[0],
      detail: null,
    });
  }
  return out;
}

/** Monday (or Sunday) of the week containing `date`. */
export function weekStartOf(date: string, weekStartsOn: 1 | 7 = 1): string {
  const d = new Date(`${date}T12:00:00Z`);
  const wd = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
  const back = weekStartsOn === 1 ? wd - 1 : wd % 7;
  d.setUTCDate(d.getUTCDate() - back);
  return d.toISOString().slice(0, 10);
}

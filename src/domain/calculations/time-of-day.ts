/**
 * Times of day as "HH:MM" (24-hour), picked from a list instead of typed: hours, then minutes in
 * 5-minute steps. Pure.
 */
export const TIME_STEP_MIN = 5;
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export const isTimeOfDay = (t: string | null | undefined): t is string => !!t && HHMM.test(t);

export const minutesOf = (t: string): number => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

export const timeOf = (minutes: number): string => {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

const bounds = (min?: string | null, max?: string | null) => ({
  lo: isTimeOfDay(min) ? minutesOf(min) : 0,
  hi: isTimeOfDay(max) ? minutesOf(max) : 23 * 60 + 59,
});

/** Hours that have at least one pickable time in [min, max]. */
export function pickerHours(min?: string | null, max?: string | null, step = TIME_STEP_MIN) {
  return Array.from({ length: 24 }, (_, h) => h).filter(
    (h) => pickerMinutes(h, min, max, step).length > 0,
  );
}

/** Minutes (0, 5 … 55) of `hour` that fall in [min, max]. */
export function pickerMinutes(
  hour: number,
  min?: string | null,
  max?: string | null,
  step = TIME_STEP_MIN,
) {
  const { lo, hi } = bounds(min, max);
  const out: number[] = [];
  for (let m = 0; m < 60; m += step) {
    const t = hour * 60 + m;
    if (t >= lo && t <= hi) out.push(m);
  }
  return out;
}

/**
 * The pickable time nearest to `value` (rounded to the step, kept in [min, max]). With no value,
 * `fallback` is used. A stored time like 07:32 is shown as it is; only the picker starts at 07:30.
 */
export function snapTime(
  value: string | null | undefined,
  min?: string | null,
  max?: string | null,
  fallback = '18:00',
  step = TIME_STEP_MIN,
): string {
  const { lo, hi } = bounds(min, max);
  const base = isTimeOfDay(value) ? minutesOf(value) : minutesOf(fallback);
  const rounded = Math.round(base / step) * step;
  const loStep = Math.ceil(lo / step) * step;
  const hiStep = Math.floor(hi / step) * step;
  return timeOf(Math.min(Math.max(rounded, loStep), hiStep));
}

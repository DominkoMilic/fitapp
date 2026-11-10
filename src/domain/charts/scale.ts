/** Small, dependency-free chart helpers (linear scales and "nice" ticks). Pure. */

export interface Scale {
  (value: number): number;
  domain: [number, number];
  range: [number, number];
}

export function linearScale(domain: [number, number], range: [number, number]): Scale {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const span = d1 - d0 || 1;
  const s = ((v: number) => r0 + ((v - d0) / span) * (r1 - r0)) as Scale;
  s.domain = domain;
  s.range = range;
  return s;
}

/** About `count` round tick values covering [min, max]. */
export function niceTicks(min: number, max: number, count = 4): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [];
  if (min === max) return [min];
  const raw = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const ratio = raw / mag;
  // d3's rule: pick 1, 2, 5 or 10 × 10^n nearest (geometrically) to the raw step.
  const step =
    mag *
    (ratio >= Math.sqrt(50) ? 10 : ratio >= Math.sqrt(10) ? 5 : ratio >= Math.sqrt(2) ? 2 : 1);
  const start = Math.ceil(min / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= max + step * 1e-9; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  return ticks;
}

/** Padded y-domain including reference lines, at least `minSpan` wide. */
export function yDomain(values: readonly number[], minSpan = 2): [number, number] {
  const finite = values.filter(Number.isFinite);
  if (!finite.length) return [0, 1];
  let lo = Math.min(...finite);
  let hi = Math.max(...finite);
  if (hi - lo < minSpan) {
    const mid = (hi + lo) / 2;
    lo = mid - minSpan / 2;
    hi = mid + minSpan / 2;
  }
  const pad = (hi - lo) * 0.08;
  return [lo - pad, hi + pad];
}

/** Splits a series into continuous segments, breaking on null values. */
export function segments<T>(points: readonly T[], isGap: (p: T) => boolean): T[][] {
  const out: T[][] = [];
  let current: T[] = [];
  for (const p of points) {
    if (isGap(p)) {
      if (current.length) out.push(current);
      current = [];
    } else current.push(p);
  }
  if (current.length) out.push(current);
  return out;
}

/** Day number of each point plus its plotted value. */
export interface LinePoint {
  day: number;
  value: number;
}

/**
 * SVG paths for a series of daily values: consecutive days are joined with a solid line, and a
 * stretch longer than `gapDays` without data is joined with a separate dashed path, so a gap is
 * never drawn as if it were measured. Points must be sorted by day. Pure.
 */
export function dailyLinePaths(
  points: readonly LinePoint[],
  x: (day: number) => number,
  y: (value: number) => number,
  gapDays = 7,
): { solid: string; dashed: string } {
  const at = (p: LinePoint) => `${x(p.day).toFixed(1)},${y(p.value).toFixed(1)}`;
  let solid = '';
  let dashed = '';
  points.forEach((p, i) => {
    const prev = points[i - 1];
    if (!prev) {
      solid += `M${at(p)}`;
    } else if (p.day - prev.day > gapDays) {
      dashed += `M${at(prev)} L${at(p)} `;
      solid += ` M${at(p)}`;
    } else {
      solid += ` L${at(p)}`;
    }
  });
  return { solid: solid.trim(), dashed: dashed.trim() };
}

/**
 * Weight chart y-range: from the lowest to the highest of the target(s), the start and every value
 * in view, so the target sits at the bottom and the start at the top (or the other way round for
 * a muscle-gain goal). It grows on its own when a weight goes past either limit. Small padding
 * so the axis tags sit near the edges; at least `minSpan` wide. Pure.
 */
export function weightYDomain({
  values,
  startKg = null,
  targetKg = null,
  secondaryKg = null,
  minSpan = 2,
}: {
  values: readonly number[];
  startKg?: number | null;
  targetKg?: number | null;
  secondaryKg?: number | null;
  minSpan?: number;
}): [number, number] {
  const all = [...values, startKg, targetKg, secondaryKg].filter(
    (v): v is number => v !== null && Number.isFinite(v),
  );
  if (!all.length) return [0, 1];
  let lo = Math.min(...all);
  let hi = Math.max(...all);
  if (hi - lo < minSpan) {
    const mid = (hi + lo) / 2;
    lo = mid - minSpan / 2;
    hi = mid + minSpan / 2;
  }
  const pad = (hi - lo) * 0.04;
  return [lo - pad, hi + pad];
}

/**
 * Moves axis labels (sorted or not) apart so neighbours are at least `gap` px apart, keeping them
 * inside [min, max]. Returns positions in the input order. Pure.
 */
export function spreadLabels(ys: readonly number[], gap: number, min: number, max: number) {
  const order = ys.map((y, i) => ({ y, i })).sort((a, b) => a.y - b.y);
  for (let k = 1; k < order.length; k++)
    if (order[k]!.y - order[k - 1]!.y < gap) order[k]!.y = order[k - 1]!.y + gap;
  // Pushed past the bottom: shift the whole stack back up.
  const overflow = order.length ? order[order.length - 1]!.y - max : 0;
  if (overflow > 0) for (const o of order) o.y -= overflow;
  for (const o of order) o.y = Math.max(min, o.y);
  const out = new Array<number>(ys.length);
  for (const o of order) out[o.i] = o.y;
  return out;
}

/**
 * Snaps a range outward to round steps (1, 2, 5 or 10 × 10ⁿ) so the axis reads e.g.
 * 85 · 90 · … · 110 for 87–108, with at most `maxTicks` labels. Pure.
 */
export function niceDomain(
  lo: number,
  hi: number,
  maxTicks = 6,
): { min: number; max: number; step: number; ticks: number[] } {
  if (!Number.isFinite(lo) || !Number.isFinite(hi))
    return { min: 0, max: 1, step: 1, ticks: [0, 1] };
  if (hi < lo) [lo, hi] = [hi, lo];
  if (hi === lo) hi = lo + 1;
  const raw = (hi - lo) / Math.max(1, maxTicks - 1);
  const mag = 10 ** Math.floor(Math.log10(raw));
  let step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  let min = Math.floor(lo / step) * step;
  let max = Math.ceil(hi / step) * step;
  // Snapping outward can add a tick too many: take the next step up.
  while ((max - min) / step + 1 > maxTicks) {
    step = [2, 5, 10].map((m) => m * mag).find((s) => s > step) ?? step * 2;
    min = Math.floor(lo / step) * step;
    max = Math.ceil(hi / step) * step;
  }
  const ticks: number[] = [];
  for (let v = min; v <= max + step * 1e-9; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  return { min, max, step, ticks };
}

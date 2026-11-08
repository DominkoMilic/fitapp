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

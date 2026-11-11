/**
 * The shape of a route for sharing (spec 33, decision 2026-11-24): the line only, with no map or
 * location. Points are simplified, projected and scaled into a 0–1000 box, so the result can't be
 * placed on a map. Pure.
 */
export type RouteShape = number[][][];

const BOX = 1000;
const MAX_POINTS = 120;
const MAX_PIECES = 4;

interface LatLngLike {
  lat: number;
  lng: number;
}

type XY = [number, number];

function perpendicular(p: XY, a: XY, b: XY): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy);
  if (len === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  return Math.abs(dy * p[0] - dx * p[1] + b[0] * a[1] - b[1] * a[0]) / len;
}

/** Douglas–Peucker: keeps the points that matter for the shape. */
export function simplify(points: readonly XY[], tolerance: number): XY[] {
  if (points.length <= 2) return [...points];
  let maxD = 0;
  let index = 0;
  const first = points[0]!;
  const last = points[points.length - 1]!;
  for (let i = 1; i < points.length - 1; i++) {
    const d = perpendicular(points[i]!, first, last);
    if (d > maxD) {
      maxD = d;
      index = i;
    }
  }
  if (maxD <= tolerance) return [first, last];
  const left = simplify(points.slice(0, index + 1), tolerance);
  const right = simplify(points.slice(index), tolerance);
  return [...left.slice(0, -1), ...right];
}

/** Shape of the route, or null when there is nothing to draw (fewer than 2 points). */
export function routeShape(pieces: readonly (readonly LatLngLike[])[]): RouteShape | null {
  const used = pieces.filter((p) => p.length > 1).slice(0, MAX_PIECES);
  const all = used.flat();
  if (all.length < 2) return null;
  // Equirectangular projection (fine at activity scale), y pointing down like the screen.
  const lat0 = all.reduce((a, p) => a + p.lat, 0) / all.length;
  const k = Math.cos((lat0 * Math.PI) / 180);
  const proj = used.map((piece) => piece.map((p): XY => [p.lng * k, -p.lat]));
  const xs = proj.flat().map((p) => p[0]);
  const ys = proj.flat().map((p) => p[1]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const span = Math.max(Math.max(...xs) - minX, Math.max(...ys) - minY);
  if (span <= 0) return null;
  const scaled = proj.map((piece) =>
    piece.map((p): XY => [((p[0] - minX) / span) * BOX, ((p[1] - minY) / span) * BOX]),
  );
  // Simplify harder until the whole shape fits the point budget.
  let tolerance = 2;
  let out = scaled.map((piece) => simplify(piece, tolerance));
  while (out.reduce((a, p) => a + p.length, 0) > MAX_POINTS && tolerance < BOX) {
    tolerance *= 1.5;
    out = scaled.map((piece) => simplify(piece, tolerance));
  }
  return out
    .map((piece) => piece.map(([x, y]) => [Math.round(x), Math.round(y)]))
    .filter((piece) => piece.length > 1);
}

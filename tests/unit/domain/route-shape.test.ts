import { routeShape, simplify } from '@/domain/activity/route-shape';

// A loop of ~400 points around a park in Split (real-looking coordinates).
const loop = Array.from({ length: 400 }, (_, i) => {
  const a = (i / 400) * 2 * Math.PI;
  return { lat: 43.5081 + 0.004 * Math.sin(a), lng: 16.4402 + 0.006 * Math.cos(a) };
});

describe('route shape for sharing', () => {
  it('keeps only the line: scaled into a 0–1000 box, nothing that locates it', () => {
    const shape = routeShape([loop])!;
    const pts = shape.flat();
    expect(pts.every(([x, y]) => x! >= 0 && x! <= 1000 && y! >= 0 && y! <= 1000)).toBe(true);
    expect(Math.max(...pts.map((p) => p[0]!))).toBe(1000);
    // No original coordinate survives.
    expect(JSON.stringify(shape)).not.toMatch(/43\.5|16\.4/);
  });

  it('keeps the aspect ratio and stays within the point budget', () => {
    const shape = routeShape([loop])!;
    const pts = shape.flat();
    const height = Math.max(...pts.map((p) => p[1]!)) - Math.min(...pts.map((p) => p[1]!));
    // East–west span is wider than north–south here, so height < width (1000).
    expect(height).toBeGreaterThan(700);
    expect(height).toBeLessThan(1000);
    expect(pts.length).toBeLessThanOrEqual(120);
  });

  it('has nothing to draw for a single point or no movement', () => {
    expect(routeShape([[loop[0]!]])).toBeNull();
    expect(routeShape([[loop[0]!, loop[0]!]])).toBeNull();
    expect(routeShape([])).toBeNull();
  });

  it('simplifies straight runs to their ends', () => {
    expect(
      simplify(
        [
          [0, 0],
          [1, 0],
          [2, 0],
          [3, 0],
        ],
        0.5,
      ),
    ).toEqual([
      [0, 0],
      [3, 0],
    ]);
  });
});

import { projectPieces } from '@/features/activity/RouteSvg';

describe('route shape projection', () => {
  it('fits all pieces in the box and keeps north up', () => {
    const pieces = [
      [
        { lat: 45.8, lng: 15.97 },
        { lat: 45.81, lng: 15.97 },
      ],
      [{ lat: 45.81, lng: 15.98 }],
    ];
    const out = projectPieces(pieces, 320, 220);
    const pts = out.flat();
    expect(out).toHaveLength(2);
    for (const p of pts) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(320);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(220);
    }
    // the second point is further north → higher on screen (smaller y)
    expect(out[0]![1]!.y).toBeLessThan(out[0]![0]!.y);
  });
  it('handles an empty route', () => {
    expect(projectPieces([], 100, 100)).toEqual([]);
  });
});

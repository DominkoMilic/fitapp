import { EXERCISE_BY_SLUG } from '@/domain/training/catalogue';
import {
  FLOOR_Y,
  MOTION_BY_SLUG,
  motionFor,
  PATTERNS,
  POSE_LENGTH,
  poseAt,
  skeletonOf,
  skeletonPaths,
  VIEW_H,
  VIEW_W,
} from '@/domain/training/motion/poses';

describe('exercise animations', () => {
  it('maps only real catalogue exercises to existing patterns', () => {
    for (const [slug, id] of Object.entries(MOTION_BY_SLUG)) {
      expect(EXERCISE_BY_SLUG[slug]).toBeDefined();
      expect(PATTERNS[id]).toBeDefined();
    }
  });

  it('has no animation rather than a wrong one for unmapped exercises', () => {
    expect(motionFor('thoracic-rotation')).toBeNull();
    expect(motionFor('not-an-exercise')).toBeNull();
  });

  it.each(Object.keys(PATTERNS))('%s stays inside the view in every frame', (id) => {
    const m = motionFor(Object.keys(MOTION_BY_SLUG).find((s) => MOTION_BY_SLUG[s] === id) ?? '');
    if (!m) return; // a pattern nothing uses yet
    expect(m.keys.every((k) => k.length === POSE_LENGTH && k.every(Number.isFinite))).toBe(true);
    for (let t = 0; t < m.keys.length; t += 0.25) {
      const s = skeletonOf(poseAt(m.keys, t), m.anchorJoint, m.anchorX, m.anchorY);
      for (const [x, y] of Object.values(s)) {
        expect(x).toBeGreaterThan(-2);
        expect(x).toBeLessThan(VIEW_W + 2);
        expect(y).toBeGreaterThan(-2);
        expect(y).toBeLessThanOrEqual(FLOOR_Y + 0.01);
      }
      expect(s.head[1]).toBeLessThan(VIEW_H);
    }
  });

  it('keeps grounded figures on the floor (lowest point touches it)', () => {
    const m = motionFor('bodyweight-squat')!;
    const s = skeletonOf(poseAt(m.keys, 1), m.anchorJoint, m.anchorX, m.anchorY);
    const low = Math.max(...Object.values(s).map((p) => p[1]));
    expect(low).toBeCloseTo(FLOOR_Y, 5);
  });

  it('loops smoothly: the end of the loop is the first pose', () => {
    const m = motionFor('push-up')!;
    expect(poseAt(m.keys, m.keys.length)).toEqual(poseAt(m.keys, 0));
    expect(skeletonPaths(skeletonOf(m.keys[0]!, m.anchorJoint, m.anchorX, null)).near).toMatch(
      /^M/,
    );
  });
});

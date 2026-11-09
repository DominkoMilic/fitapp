import { activityRecords } from '@/domain/activity/records';
import { evaluateMilestones } from '@/domain/milestones/evaluate';
import { localDateInTimezone } from '@/domain/calculations/dates';
import {
  formatDistance,
  formatPace,
  formatSpeed,
  haversineM,
  paceSecondsPerKm,
  speedMps,
} from '@/domain/activity/geo';
import {
  addPoint,
  emptyTrack,
  gpsQuality,
  type RawPoint,
  type Track,
} from '@/domain/activity/gps-filter';
import { activityCalories, metFor } from '@/domain/activity/met';
import {
  addPoints,
  canResume,
  finishRecording,
  liveStats,
  pauseRecording,
  resumeRecording,
  startRecording,
} from '@/domain/activity/recording';
import {
  decodePolyline,
  decodeRoute,
  encodePolyline,
  encodeRoute,
} from '@/domain/activity/route-codec';

/** Points heading north at `mps` from (45.8, 15.97), one every `everyS` seconds. */
const line = (n: number, mps: number, everyS = 2, t0 = 1_000_000, acc = 5): RawPoint[] =>
  Array.from({ length: n }, (_, i) => ({
    t: t0 + i * everyS * 1000,
    lat: 45.8 + (i * mps * everyS) / 111_195,
    lng: 15.97,
    alt: 120,
    acc,
  }));
const feed = (
  pts: RawPoint[],
  type: 'walk' | 'run' | 'cycle' = 'run',
  start: Track = emptyTrack(),
) => pts.reduce((tr, p) => addPoint(tr, p, type).track, start);

describe('geo vectors (spec 29.4)', () => {
  it('G1/G2 one degree ≈ 111 195 m', () => {
    expect(haversineM({ lat: 0, lng: 0 }, { lat: 0, lng: 1 })).toBeCloseTo(111_195, -0);
    expect(
      Math.abs(haversineM({ lat: 0, lng: 0 }, { lat: 1, lng: 0 }) - 111_195),
    ).toBeLessThanOrEqual(1);
  });
  it('G3 5000 m in 1500 s → 5:00 /km, 8:03 /mi, 12.0 km/h', () => {
    const pace = paceSecondsPerKm(5000, 1500);
    expect(pace).toBe(300);
    expect(formatPace(pace, 'metric')).toBe('5:00');
    expect(formatPace(pace, 'imperial')).toBe('8:03');
    expect(formatSpeed(speedMps(5000, 1500), 'metric')).toBe('12.0 km/h');
    expect(formatDistance(5000, 'imperial')).toBe('3.11 mi');
  });
  it('no pace below 100 m', () => expect(paceSecondsPerKm(99, 60)).toBeNull());
  it('G7 run 30 min at 10 km/h, 108 kg → 529 kcal; G8 walk 5 km/h → 189 kcal', () => {
    expect(metFor('run', 10)).toBe(9.8);
    expect(activityCalories('run', 10, 108, 1800)).toBe(529);
    expect(activityCalories('walk', 5, 108, 1800)).toBe(189);
    expect(metFor('cycle', 20)).toBe(8.0);
    expect(metFor('walk', 6.0)).toBe(5.0); // lower-inclusive
  });
  it('G9 an activity across midnight belongs to its start day', () => {
    const start = new Date('2026-11-09T22:50:00Z'); // 23:50 in Zagreb
    expect(localDateInTimezone(start, 'Europe/Zagreb')).toBe('2026-11-09');
  });
});

describe('GPS filter (spec 11.4, 28.6)', () => {
  it('accumulates distance along a clean run', () => {
    const t = feed(line(51, 3)); // 100 s at 3 m/s
    expect(t.distanceM).toBeCloseTo(300, -1);
    expect(gpsQuality(t)).toBe('good');
  });
  it('G4 rejects points with accuracy worse than 25 m', () => {
    const r = addPoint(feed(line(1, 3)), { ...line(2, 3)[1]!, acc: 40 }, 'run');
    expect(r.verdict).toBe('reject_accuracy');
  });
  it('G5 rejects a 50 m/s spike when running', () => {
    const base = feed(line(1, 3));
    const spike = { t: 1_002_000, lat: 45.8 + 100 / 111_195, lng: 15.97, alt: null, acc: 5 };
    expect(addPoint(base, spike, 'run').verdict).toBe('reject_speed');
    expect(addPoint(base, spike, 'cycle').verdict).toBe('reject_speed'); // 50 m/s > 25
  });
  it('stationary jitter adds no distance', () => {
    const still = Array.from({ length: 30 }, (_, i) => ({
      t: 1_000_000 + i * 2000,
      lat: 45.8 + ((i % 3) - 1) * 1e-5,
      lng: 15.97,
      alt: null,
      acc: 8,
    }));
    const t = feed(still);
    expect(t.distanceM).toBe(0);
    expect(t.pointsValid).toBe(30);
  });
  it('rejects duplicate and out-of-order timestamps', () => {
    const pts = line(3, 3);
    const t = feed(pts);
    expect(addPoint(t, pts[1]!, 'run').verdict).toBe('reject_order');
    expect(addPoint(t, pts[2]!, 'run').verdict).toBe('reject_order');
  });
  it('signal loss: a plausible jump after 2 min is bridged; an implausible one starts a new piece', () => {
    const t = feed(line(5, 3));
    const after = 1_000_000 + 8000 + 120_000;
    const plausible = {
      t: after,
      lat: 45.8 + (4 * 3 * 2 + 300) / 111_195,
      lng: 15.97,
      alt: null,
      acc: 5,
    };
    const ok = addPoint(t, plausible, 'run');
    expect(ok.verdict).toBe('accept');
    expect(ok.track.distanceM - t.distanceM).toBeCloseTo(300, -1);
    const far = { ...plausible, lat: 46.5 };
    const bad = addPoint(t, far, 'run');
    expect(bad.verdict).toBe('new_piece');
    expect(bad.track.distanceM).toBe(t.distanceM);
    expect(bad.track.pieces).toHaveLength(2);
  });
  it('re-anchors after repeated rejections so one bad fix cannot block a recording', () => {
    let t = feed([{ t: 0, lat: 46.5, lng: 15.97, alt: null, acc: 5 }]); // bad anchor far away
    const verdicts: string[] = [];
    for (const p of line(8, 3, 2, 2000)) {
      const r = addPoint(t, p, 'run');
      verdicts.push(r.verdict);
      t = r.track;
    }
    expect(verdicts.slice(0, 4)).toEqual([
      'reject_speed',
      'reject_speed',
      'reject_speed',
      'reject_speed',
    ]);
    expect(verdicts[4]).toBe('new_piece');
    expect(verdicts.slice(5)).toEqual(['accept', 'accept', 'accept']);
  });
  it('quality: mostly rejected or inaccurate points → poor', () => {
    expect(gpsQuality({ pointsTotal: 10, pointsValid: 5, accuracies: [5] })).toBe('poor');
    expect(gpsQuality({ pointsTotal: 10, pointsValid: 8, accuracies: Array(8).fill(15) })).toBe(
      'fair',
    );
    expect(gpsQuality({ pointsTotal: 0, pointsValid: 0, accuracies: [] })).toBe('none');
  });
});

describe('recording', () => {
  const T0 = 1_000_000;
  it('G6 no distance across a pause; paused time excluded', () => {
    let r = startRecording({ id: 'a', userId: 'u', type: 'walk', now: T0 });
    r = addPoints(r, line(11, 1.5, 2, T0), T0 + 20_000); // 30 m
    r = pauseRecording(r, T0 + 20_000);
    r = addPoints(r, [{ t: T0 + 30_000, lat: 45.81, lng: 15.97, alt: null, acc: 5 }], T0 + 30_000); // ignored while paused
    r = resumeRecording(r, T0 + 80_000);
    r = addPoints(
      r,
      line(11, 1.5, 2, T0 + 80_000).map((p) => ({ ...p, lat: p.lat + 0.0045 })),
      T0 + 100_000,
    ); // 500 m away
    const s = liveStats(r, T0 + 100_000, 80);
    expect(s.distanceM).toBeCloseTo(60, -1); // 30 + 30, nothing for the 500 m jump
    expect(s.movingS).toBe(40);
    expect(s.elapsedS).toBe(100);
  });
  it('finish: short activities are flagged; summary consistent', () => {
    let r = startRecording({ id: 'a', userId: 'u', type: 'run', now: T0 });
    r = addPoints(r, line(10, 3, 2, T0), T0 + 18_000);
    const s = finishRecording(r, T0 + 20_000, 108);
    expect(s.isShort).toBe(true);
    expect(s.movingS).toBe(20);
    expect(s.avgPaceSPerKm).toBeNull(); // < 100 m
    const long = finishRecording(
      addPoints(r, line(400, 3, 2, T0 + 20_000).slice(1), T0 + 820_000),
      T0 + 820_000,
      108,
    );
    expect(long.isShort).toBe(false);
    expect(long.distanceM).toBeGreaterThan(2300);
    expect(long.avgPaceSPerKm).toBeGreaterThan(300);
    expect(long.kcal).toBeGreaterThan(0);
  });
  it('resume is offered only within 6 hours', () => {
    const r = startRecording({ id: 'a', userId: 'u', type: 'run', now: T0 });
    expect(canResume(r, T0 + 5 * 3600_000)).toBe(true);
    expect(canResume(r, T0 + 7 * 3600_000)).toBe(false);
  });
});

describe('route file', () => {
  it('polyline round trip within 1 m', () => {
    const pts = [
      { lat: 45.81234, lng: 15.97765 },
      { lat: 45.81301, lng: 15.97802 },
      { lat: -33.8688, lng: 151.2093 },
    ];
    const back = decodePolyline(encodePolyline(pts));
    pts.forEach((p, i) => expect(haversineM(p, back[i]!)).toBeLessThan(1));
  });
  it('encodes pieces compactly and decodes defensively', () => {
    const f = encodeRoute([line(100, 3), [], line(5, 3, 2, 2_000_000)]);
    expect(f.pieces).toHaveLength(2);
    expect(JSON.stringify(f).length).toBeLessThan(2000);
    expect(decodeRoute(JSON.parse(JSON.stringify(f)))?.map((p) => p.length)).toEqual([100, 5]);
    expect(decodeRoute({ v: 2 })).toBeNull();
    expect(decodeRoute({ v: 1, pieces: [{ p: '~' }] })).toBeNull();
  });
});

describe('activity milestones and records (spec 14.3, 28.8 #5)', () => {
  const a = (over: object) => ({
    id: 'x',
    date: '2026-11-10',
    type: 'run',
    distanceM: 5200,
    movingS: 1800,
    paceSPerKm: 346,
    quality: 'good',
    source: 'gps',
    ...over,
  });
  it('unlocks distance milestones only with trusted distance', () => {
    const keys = (acts: object[]) =>
      evaluateMilestones({
        goal: null,
        daily: [],
        logDates: [],
        unlockedKeys: new Set(),
        activities: acts as never,
      }).map((m) => m.key);
    expect(keys([a({})])).toContain('run_5k');
    expect(keys([a({ quality: 'poor' })])).not.toContain('run_5k');
    expect(keys([a({ source: 'manual', quality: 'none' })])).toContain('run_5k');
    expect(keys([a({ type: 'cycle', distanceM: 26000 })])).toEqual(
      expect.arrayContaining(['cycle_10k', 'cycle_25k']),
    );
  });
  it('activity time counts toward training hours', () => {
    const acts = Array.from({ length: 20 }, (_, i) =>
      a({ date: `2026-11-${String(i + 1).padStart(2, '0')}`, movingS: 1800 }),
    );
    const keys = evaluateMilestones({
      goal: null,
      daily: [],
      logDates: [],
      unlockedKeys: new Set(),
      activities: acts,
    }).map((m) => m.key);
    expect(keys).toContain('training_hours_10');
  });
  it('records: poor GPS excluded, manual never sets pace', () => {
    const recs = activityRecords([
      a({ id: '1', distanceM: 5200, paceSPerKm: 346 }),
      a({ id: '2', distanceM: 9000, paceSPerKm: 300, quality: 'poor' }),
      a({ id: '3', distanceM: 8000, paceSPerKm: 290, source: 'manual', quality: 'none' }),
      a({ id: '4', distanceM: 800, paceSPerKm: 250 }),
      a({ id: '5', type: 'walk', distanceM: 4000, paceSPerKm: 700 }),
    ]);
    const by = Object.fromEntries(recs.map((r) => [r.key, r]));
    expect(by.longest_run).toMatchObject({ activityId: '3', manual: true });
    expect(by.fastest_run_pace).toMatchObject({ activityId: '1', value: 346 });
    expect(by.longest_walk?.value).toBe(4000);
    expect(by.longest_cycle).toBeUndefined();
  });
});

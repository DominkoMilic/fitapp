import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  BATCH_WINDOW_MS,
  cheerEmoji,
  cheerTotal,
  FEED_SNAPSHOT_KEYS,
  feedDetail,
  feedTitle,
  formatPace,
  inQuietHours,
  pushText,
  relativeDay,
  shouldBatch,
} from '@/domain/social';

describe('feed snapshot whitelist', () => {
  it('matches the keys the database may put in a snapshot', () => {
    const dir = join(__dirname, '../../../supabase/migrations');
    const file = readdirSync(dir).find((f) => f.endsWith('_social_feed.sql'))!;
    const sql = readFileSync(join(dir, file), 'utf8');
    const fromSql = Object.fromEntries(
      [...sql.matchAll(/-- WHITELIST (\w+): ([\w,]+)/g)].map((m) => [m[1], m[2]!.split(',')]),
    );
    expect(fromSql).toEqual(
      Object.fromEntries(Object.entries(FEED_SNAPSHOT_KEYS).map(([k, v]) => [k, [...v]])),
    );
    // Things that must never be shared are not in any list.
    const all = Object.values(FEED_SNAPSHOT_KEYS).flat().join(' ');
    expect(all).not.toMatch(/weight|note|started|ended|route|exertion|feeling|calorie/);
  });
});

describe('feed card text', () => {
  it('describes a workout', () => {
    const snap = { title: 'Strength A', category: 'strength', duration_min: 45, sets: 9 };
    expect(feedTitle('workout', snap)).toBe('Strength A');
    expect(feedDetail('workout', snap)).toBe('45 min · 9 sets');
    expect(feedDetail('workout', { ...snap, sets: 1, volume_kg: 1234.5 })).toBe(
      '45 min · 1 set · 1,235 kg lifted',
    );
  });

  it('describes an activity', () => {
    const snap = {
      type: 'run',
      distance_km: 5.21,
      moving_min: 28,
      pace_s_per_km: 322,
      manual: false,
    };
    expect(feedTitle('activity', snap)).toBe('Run');
    expect(feedDetail('activity', snap)).toBe('5.21 km · 28 min · 5:22 /km');
    expect(feedDetail('activity', { type: 'cycle', moving_min: 40, manual: true })).toBe(
      '40 min · logged by hand',
    );
    expect(feedTitle('activity', { type: 'cycle' })).toBe('Ride');
  });

  it('describes a milestone and survives odd snapshots', () => {
    expect(feedTitle('milestone', { title: 'First 5 km run' })).toBe('First 5 km run');
    expect(feedDetail('milestone', {})).toBe('Milestone unlocked');
    expect(feedTitle('workout', {})).toBe('Workout');
    expect(feedDetail('workout', { duration_min: 'x' })).toBe('');
  });

  it('formats pace and days', () => {
    expect(formatPace(322)).toBe('5:22 /km');
    expect(formatPace(299.6)).toBe('5:00 /km');
    expect(relativeDay('2026-11-18', '2026-11-18')).toBe('Today');
    expect(relativeDay('2026-11-17', '2026-11-18')).toBe('Yesterday');
    expect(relativeDay('2026-11-09', '2026-11-18')).toBe('9 Nov');
  });

  it('counts cheers', () => {
    expect(cheerTotal({ clap: 2, fire: 1 })).toBe(3);
    expect(cheerTotal({})).toBe(0);
    expect(cheerEmoji('fire')).toBe('🔥');
    expect(cheerEmoji('nope')).toBe('👏');
  });
});

describe('push rules (shared with the social-push function)', () => {
  it('batches repeated events', () => {
    const now = Date.parse('2026-11-18T10:00:00Z');
    expect(shouldBatch(null, now)).toBe(false);
    expect(shouldBatch(now - 60_000, now)).toBe(true);
    expect(shouldBatch(now - BATCH_WINDOW_MS, now)).toBe(false);
  });

  it('keeps quiet between 22:00 and 07:00', () => {
    expect(inQuietHours(22 * 60)).toBe(true);
    expect(inQuietHours(3 * 60)).toBe(true);
    expect(inQuietHours(7 * 60)).toBe(false);
    expect(inQuietHours(21 * 60 + 59)).toBe(false);
  });

  it('writes short texts with names only', () => {
    expect(pushText('cheer', ['Ana'], 1, 'activity')).toEqual({
      title: 'New cheer',
      body: 'Ana cheered your activity',
    });
    expect(pushText('cheer', ['Ana', 'Bo'], 4, 'workout').body).toBe(
      'Ana and 3 others cheered your workout',
    );
    expect(pushText('cheer', ['Ana', 'Bo'], 2, 'workout').body).toBe(
      'Ana and 1 other cheered your workout',
    );
    expect(pushText('comment', ['Bo'], 1, 'milestone').body).toBe('Bo commented on your milestone');
    expect(pushText('request', ['Cy'], 1, null).body).toBe('Cy wants to be friends');
    expect(pushText('accept', [], 1, null).body).toBe('Someone accepted your friend request');
    for (const t of ['cheer', 'comment', 'request', 'accept'] as const)
      expect(JSON.stringify(pushText(t, ['Ana'], 3, 'workout'))).not.toMatch(
        /\d+\s?(kg|km|min|kcal)/,
      );
  });
});

import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import type { RawPoint } from '@/domain/activity/gps-filter';

import type { PointBuffer } from './point-buffer.types';

let dbPromise: Promise<SQLiteDatabase> | null = null;
const db = () =>
  (dbPromise ??= openDatabaseAsync('pace-gps.db').then(async (d) => {
    await d.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS gps_points (
        activity_id TEXT NOT NULL,
        t INTEGER NOT NULL,
        lat REAL NOT NULL,
        lng REAL NOT NULL,
        alt REAL,
        acc REAL,
        PRIMARY KEY (activity_id, t)
      );
    `);
    return d;
  }));

/** SQLite buffer. Written by the background task as points arrive, so nothing lives only in memory. */
export const pointBuffer: PointBuffer = {
  async append(activityId, points) {
    if (!points.length) return;
    const d = await db();
    await d.withTransactionAsync(async () => {
      for (const p of points) {
        // Duplicate timestamps are ignored (spec 28.6 #10).
        await d.runAsync(
          'INSERT OR IGNORE INTO gps_points (activity_id, t, lat, lng, alt, acc) VALUES (?, ?, ?, ?, ?, ?)',
          activityId,
          p.t,
          p.lat,
          p.lng,
          p.alt,
          p.acc,
        );
      }
    });
  },
  async all(activityId) {
    const rows = await (
      await db()
    ).getAllAsync<RawPoint>(
      'SELECT t, lat, lng, alt, acc FROM gps_points WHERE activity_id = ? ORDER BY t',
      activityId,
    );
    return rows;
  },
  async clear(activityId) {
    await (await db()).runAsync('DELETE FROM gps_points WHERE activity_id = ?', activityId);
  },
};

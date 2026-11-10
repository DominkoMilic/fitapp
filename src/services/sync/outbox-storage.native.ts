import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import { knownOps, type OutboxOp } from '@/domain/sync/outbox';

import type { OutboxStorage } from './storage.types';

let dbPromise: Promise<SQLiteDatabase> | null = null;

function db(): Promise<SQLiteDatabase> {
  dbPromise ??= openDatabaseAsync('pace-sync.db').then(async (d) => {
    await d.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS outbox (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL,
        position INTEGER NOT NULL,
        op TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS outbox_user ON outbox (user_id, position);
    `);
    return d;
  });
  return dbPromise;
}

/** SQLite outbox (iOS/Android): survives app kills and restarts. */
export const outboxStorage: OutboxStorage = {
  async load(userId) {
    const rows = await (
      await db()
    ).getAllAsync<{ op: string }>(
      'SELECT op FROM outbox WHERE user_id = ? ORDER BY position',
      userId,
    );
    return knownOps(rows.map((r) => JSON.parse(r.op) as OutboxOp));
  },
  async replaceAll(userId, ops) {
    const d = await db();
    await d.withTransactionAsync(async () => {
      await d.runAsync('DELETE FROM outbox WHERE user_id = ?', userId);
      let position = 0;
      for (const op of ops) {
        await d.runAsync(
          'INSERT INTO outbox (id, user_id, position, op) VALUES (?, ?, ?, ?)',
          op.id,
          userId,
          position++,
          JSON.stringify(op),
        );
      }
    });
  },
  async clear(userId) {
    await (await db()).runAsync('DELETE FROM outbox WHERE user_id = ?', userId);
  },
};

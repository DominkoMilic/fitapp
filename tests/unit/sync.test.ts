import {
  applyPending,
  backoffMs,
  classifyError,
  enqueue,
  markFailed,
  type NewOp,
  type OutboxOp,
  queueSummary,
  readyOps,
} from '@/domain/sync/outbox';
import { MemoryOutboxStorage } from '@/services/sync/storage.types';
import { SyncEngine, type Transport } from '@/services/sync/sync-engine';

const T0 = '2026-11-09T07:00:00.000Z';
const op = (over: Partial<NewOp> = {}): NewOp => ({
  id: 'op-' + Math.random().toString(36).slice(2),
  userId: 'u1',
  entity: 'weight_entries',
  recordKey: 'w1',
  kind: 'upsert',
  payload: { id: 'w1', weight_kg: 108 },
  createdOffline: true,
  ...over,
});

describe('outbox collapsing (spec 28.10 #1)', () => {
  it('create + delete before sync → nothing is sent', () => {
    let q = enqueue([], op(), T0);
    q = enqueue(q, op({ kind: 'delete', payload: null }), T0);
    expect(q).toEqual([]);
  });
  it('two upserts of the same record → one op with the latest payload', () => {
    let q = enqueue([], op(), T0);
    q = enqueue(q, op({ payload: { id: 'w1', weight_kg: 107.5 } }), '2026-11-09T07:01:00.000Z');
    expect(q).toHaveLength(1);
    expect(q[0]?.payload).toEqual({ id: 'w1', weight_kg: 107.5 });
    expect(q[0]?.createdAt).toBe(T0); // keeps FIFO position
  });
  it('deleting a record that exists on the server keeps the delete', () => {
    const q = enqueue([], op({ kind: 'delete', payload: null, createdOffline: false }), T0);
    expect(q).toHaveLength(1);
    expect(q[0]?.kind).toBe('delete');
  });
  it('editing a server record then deleting it sends the delete', () => {
    let q = enqueue([], op({ createdOffline: false }), T0);
    q = enqueue(q, op({ kind: 'delete', payload: null, createdOffline: false }), T0);
    expect(q.map((o) => o.kind)).toEqual(['delete']);
  });
  it('different records are independent', () => {
    let q = enqueue([], op(), T0);
    q = enqueue(q, op({ recordKey: 'w2', payload: { id: 'w2' } }), T0);
    expect(q).toHaveLength(2);
  });
});

describe('ordering and retry', () => {
  it('ready ops are FIFO and respect backoff', () => {
    let q = enqueue([], op({ recordKey: 'a' }), '2026-11-09T07:00:00.000Z');
    q = enqueue(q, op({ recordKey: 'b' }), '2026-11-09T07:00:01.000Z');
    q = markFailed(q, q[0]!.id, 'network', 'offline', new Date('2026-11-09T07:00:02.000Z'));
    expect(readyOps(q, '2026-11-09T07:00:02.500Z').map((o) => o.recordKey)).toEqual(['b']);
    expect(readyOps(q, '2026-11-09T07:00:10.000Z').map((o) => o.recordKey)).toEqual(['a', 'b']);
  });
  it('backoff doubles and caps at 5 minutes', () => {
    expect([1, 2, 3, 4].map(backoffMs)).toEqual([2000, 4000, 8000, 16000]);
    expect(backoffMs(50)).toBe(300000);
  });
  it('permanent errors mark the op failed and keep it (never dropped)', () => {
    let q = enqueue([], op(), T0);
    q = markFailed(q, q[0]!.id, 'permanent', 'violates check constraint', new Date(T0));
    expect(q[0]?.status).toBe('failed');
    expect(queueSummary(q)).toEqual({ pending: 0, failed: 1 });
    expect(readyOps(q, '2030-01-01T00:00:00.000Z')).toEqual([]);
  });
});

describe('error classification', () => {
  it.each([
    [{ status: 0, message: 'TypeError: Network request failed' }, 'network'],
    [{ status: null, message: 'Failed to fetch' }, 'network'],
    [{ status: 503 }, 'network'],
    [{ status: 429 }, 'network'],
    [{ status: 401, message: 'JWT expired' }, 'auth'],
    [
      { status: 403, code: '42501', message: 'new row violates row-level security policy' },
      'permanent',
    ],
    [{ status: 400, code: '23514', message: 'violates check constraint' }, 'permanent'],
  ] as const)('%j → %s', (e, cls) => expect(classifyError(e)).toBe(cls));
});

describe('local view (pending writes applied over server rows)', () => {
  it('adds offline entries, applies edits and hides deletes', () => {
    const server = [
      { id: 'w1', weight_kg: 108 },
      { id: 'w2', weight_kg: 107 },
    ];
    let q: OutboxOp[] = enqueue(
      [],
      op({ recordKey: 'w3', payload: { id: 'w3', weight_kg: 106 } }),
      T0,
    );
    q = enqueue(
      q,
      op({ recordKey: 'w1', payload: { id: 'w1', weight_kg: 108.5 }, createdOffline: false }),
      T0,
    );
    q = enqueue(
      q,
      op({ recordKey: 'w2', kind: 'delete', payload: null, createdOffline: false }),
      T0,
    );
    const view = applyPending(server, q, 'weight_entries', (r) => r.id);
    expect(view.map((r) => [r.id, r.weight_kg, !!r._pending])).toEqual([
      ['w1', 108.5, true],
      ['w3', 106, true],
    ]);
  });
});

describe('SyncEngine', () => {
  const setup = (transport: Transport, refreshAuth = async () => true) => {
    const storage = new MemoryOutboxStorage();
    const synced: string[][] = [];
    const engine = new SyncEngine({
      userId: 'u1',
      storage,
      transport,
      refreshAuth,
      onSynced: (e) => synced.push(e),
      now: () => new Date(T0),
    });
    return { engine, storage, synced };
  };

  it('sends queued ops and empties the queue', async () => {
    const sent: string[] = [];
    const { engine, storage, synced } = setup(async (o) => {
      sent.push(o.recordKey);
      return { error: null };
    });
    await engine.enqueue(op({ recordKey: 'a', payload: { id: 'a' } }));
    await engine.enqueue(op({ recordKey: 'b', payload: { id: 'b' } }));
    await engine.flush();
    expect(sent).toEqual(['a', 'b']);
    expect(engine.getSnapshot()).toEqual([]);
    expect(await storage.load('u1')).toEqual([]);
    expect(synced).toEqual([['weight_entries']]);
  });

  it('just-synced writes stay visible locally until fresh data arrives, then drop off', async () => {
    jest.useFakeTimers();
    try {
      const { engine } = setup(async () => ({ error: null }));
      await engine.enqueue(op({ recordKey: 'a', payload: { id: 'a', kg: 80 } }));
      await engine.flush();
      expect(engine.getSnapshot()).toEqual([]);
      expect(engine.getOverlay().map((o) => [o.recordKey, o.status])).toEqual([['a', 'synced']]);
      // Synced ops never count as pending in the sync status.
      expect(queueSummary(engine.getOverlay())).toEqual({ pending: 0, failed: 0 });
      jest.advanceTimersByTime(16_000);
      expect(engine.getOverlay()).toEqual([]);
    } finally {
      jest.useRealTimers();
    }
  });

  it('offline: keeps everything, stops after the first network error', async () => {
    let calls = 0;
    const { engine, storage } = setup(async () => {
      calls++;
      return { error: { status: 0, message: 'Network request failed' } };
    });
    await engine.enqueue(op({ recordKey: 'a', payload: { id: 'a' } }));
    await engine.enqueue(op({ recordKey: 'b', payload: { id: 'b' } }));
    await engine.flush();
    expect(calls).toBe(1);
    expect(engine.getSnapshot()).toHaveLength(2);
    expect((await storage.load('u1')).length).toBe(2); // persisted (survives app kill)
    expect(engine.getSnapshot()[0]?.status).toBe('pending');
  });

  it('expired session: refreshes once and retries the op', async () => {
    let calls = 0;
    const refresh = jest.fn(async () => true);
    const { engine } = setup(async () => {
      calls++;
      return calls === 1 ? { error: { status: 401, message: 'JWT expired' } } : { error: null };
    }, refresh);
    await engine.enqueue(op());
    await engine.flush();
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(engine.getSnapshot()).toEqual([]);
  });

  it('a rejected op is marked failed and the rest still sync', async () => {
    const { engine } = setup(async (o) =>
      o.recordKey === 'bad'
        ? { error: { status: 400, code: '23514', message: 'check constraint' } }
        : { error: null },
    );
    await engine.enqueue(op({ recordKey: 'bad', payload: { id: 'bad' } }));
    await engine.enqueue(op({ recordKey: 'good', payload: { id: 'good' } }));
    await engine.flush();
    expect(engine.getSnapshot().map((o) => [o.recordKey, o.status])).toEqual([['bad', 'failed']]);
  });

  it('a thrown transport error counts as a network error', async () => {
    const { engine } = setup(async () => {
      throw new Error('socket hang up');
    });
    await engine.enqueue(op());
    await engine.flush();
    expect(engine.getSnapshot()[0]?.status).toBe('pending');
  });

  it('restores the queue from storage (app restart)', async () => {
    const storage = new MemoryOutboxStorage();
    const first = new SyncEngine({
      userId: 'u1',
      storage,
      transport: async () => ({ error: { status: 0 } }),
      refreshAuth: async () => false,
    });
    await first.enqueue(op());
    const second = new SyncEngine({
      userId: 'u1',
      storage,
      transport: async () => ({ error: null }),
      refreshAuth: async () => false,
    });
    await second.ready();
    expect(second.getSnapshot()).toHaveLength(1);
    await second.flush();
    expect(second.getSnapshot()).toHaveLength(0);
  });

  it("never mixes users' queues (spec 28.1 #7)", async () => {
    const storage = new MemoryOutboxStorage();
    const a = new SyncEngine({
      userId: 'a',
      storage,
      transport: async () => ({ error: { status: 0 } }),
      refreshAuth: async () => false,
    });
    await a.enqueue(op());
    const b = new SyncEngine({
      userId: 'b',
      storage,
      transport: async () => ({ error: null }),
      refreshAuth: async () => false,
    });
    await b.ready();
    expect(b.getSnapshot()).toEqual([]);
    expect(await storage.load('a')).toHaveLength(1);
  });

  it('concurrent flushes share one run', async () => {
    let calls = 0;
    const { engine } = setup(async () => {
      calls++;
      return { error: null };
    });
    await engine.enqueue(op());
    await Promise.all([engine.flush(), engine.flush(), engine.flush()]);
    expect(calls).toBe(1);
  });
});

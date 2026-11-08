import {
  classifyError,
  discardOp,
  enqueue,
  markFailed,
  markSucceeded,
  type NewOp,
  type OutboxOp,
  readyOps,
  retryOp,
  type SyncEntity,
  type TransportErrorLike,
} from '@/domain/sync/outbox';

import type { OutboxStorage } from './storage.types';

export type Transport = (op: OutboxOp) => Promise<{ error: TransportErrorLike | null }>;

export interface SyncEngineOptions {
  userId: string;
  storage: OutboxStorage;
  transport: Transport;
  /** Called once when the server rejects the session; should refresh it. */
  refreshAuth: () => Promise<boolean>;
  onSynced?: (entities: SyncEntity[]) => void;
  now?: () => Date;
}

/**
 * Per-user sync engine. All queue mutations are serialised through one promise chain, the
 * queue is persisted after every change, and listeners are notified (useSyncExternalStore).
 */
export class SyncEngine {
  private queue: OutboxOp[] = [];
  private chain: Promise<unknown> = Promise.resolve();
  private flushing: Promise<void> | null = null;
  private listeners = new Set<() => void>();
  private loaded: Promise<void>;
  syncing = false;

  constructor(private readonly opts: SyncEngineOptions) {
    this.loaded = this.serial(async () => {
      this.queue = await opts.storage.load(opts.userId);
      this.emit();
    });
  }

  get userId() {
    return this.opts.userId;
  }

  private now() {
    return this.opts.now ? this.opts.now() : new Date();
  }

  private serial<T>(task: () => Promise<T>): Promise<T> {
    const run = this.chain.then(task, task);
    this.chain = run.catch(() => undefined);
    return run;
  }

  private async commit(next: OutboxOp[]) {
    this.queue = next;
    await this.opts.storage.replaceAll(this.opts.userId, next);
    this.emit();
  }

  private emit() {
    for (const l of this.listeners) l();
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): readonly OutboxOp[] => this.queue;

  ready() {
    return this.loaded;
  }

  enqueue(op: Omit<NewOp, 'userId'>): Promise<void> {
    return this.serial(() =>
      this.commit(
        enqueue(this.queue, { ...op, userId: this.opts.userId }, this.now().toISOString()),
      ),
    );
  }

  retry(opId: string): Promise<void> {
    return this.serial(() => this.commit(retryOp(this.queue, opId, this.now().toISOString())));
  }

  discard(opId: string): Promise<void> {
    return this.serial(() => this.commit(discardOp(this.queue, opId)));
  }

  /** Sends ready ops one by one. Stops at the first network error (we're offline). */
  flush(): Promise<void> {
    if (this.flushing) return this.flushing;
    this.flushing = (async () => {
      await this.loaded;
      this.syncing = true;
      this.emit();
      const synced = new Set<SyncEntity>();
      let authRetried = false;
      try {
        for (;;) {
          const op = readyOps(this.queue, this.now().toISOString())[0];
          if (!op) break;
          let result: { error: TransportErrorLike | null };
          try {
            result = await this.opts.transport(op);
          } catch (e) {
            result = {
              error: { message: e instanceof Error ? e.message : String(e), status: null },
            };
          }
          if (!result.error) {
            await this.serial(() => this.commit(markSucceeded(this.queue, op.id)));
            synced.add(op.entity);
            continue;
          }
          const cls = classifyError(result.error);
          if (cls === 'auth' && !authRetried) {
            authRetried = true;
            if (await this.opts.refreshAuth()) continue; // retry the same op once
          }
          const message = result.error.message ?? 'Unknown error';
          await this.serial(() =>
            this.commit(
              markFailed(this.queue, op.id, cls === 'auth' ? 'network' : cls, message, this.now()),
            ),
          );
          if (cls !== 'permanent') break;
        }
      } finally {
        this.syncing = false;
        this.flushing = null;
        this.emit();
        if (synced.size) this.opts.onSynced?.([...synced]);
      }
    })();
    return this.flushing;
  }

  /** Removes the user's local queue (sign-out after confirmation). */
  clear(): Promise<void> {
    return this.serial(async () => {
      await this.opts.storage.clear(this.opts.userId);
      this.queue = [];
      this.emit();
    });
  }
}

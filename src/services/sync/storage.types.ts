import type { OutboxOp } from '@/domain/sync/outbox';

/** Durable per-user storage for the outbox. Writes replace the user's whole queue atomically. */
export interface OutboxStorage {
  load(userId: string): Promise<OutboxOp[]>;
  replaceAll(userId: string, ops: readonly OutboxOp[]): Promise<void>;
  clear(userId: string): Promise<void>;
}

export class MemoryOutboxStorage implements OutboxStorage {
  private data = new Map<string, OutboxOp[]>();
  async load(userId: string) {
    return [...(this.data.get(userId) ?? [])];
  }
  async replaceAll(userId: string, ops: readonly OutboxOp[]) {
    this.data.set(userId, [...ops]);
  }
  async clear(userId: string) {
    this.data.delete(userId);
  }
}

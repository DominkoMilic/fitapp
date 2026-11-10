import AsyncStorage from '@react-native-async-storage/async-storage';

import { knownOps, type OutboxOp } from '@/domain/sync/outbox';

import type { OutboxStorage } from './storage.types';

const key = (userId: string) => `pace.outbox.${userId}`;

/** Web fallback (and Jest): AsyncStorage-backed outbox. Native builds use outbox-storage.native.ts. */
export const outboxStorage: OutboxStorage = {
  async load(userId) {
    const raw = await AsyncStorage.getItem(key(userId));
    return raw ? knownOps(JSON.parse(raw) as OutboxOp[]) : [];
  },
  async replaceAll(userId, ops) {
    await AsyncStorage.setItem(key(userId), JSON.stringify(ops));
  },
  async clear(userId) {
    await AsyncStorage.removeItem(key(userId));
  },
};

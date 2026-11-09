import AsyncStorage from '@react-native-async-storage/async-storage';

import type { RawPoint } from '@/domain/activity/gps-filter';

import type { PointBuffer } from './point-buffer.types';

const key = (id: string) => `pace.gps.${id}`;
const cache = new Map<string, RawPoint[]>();

/** Web/test buffer (web only records in the foreground): memory + AsyncStorage. */
export const pointBuffer: PointBuffer = {
  async append(activityId, points) {
    const cur =
      cache.get(activityId) ?? JSON.parse((await AsyncStorage.getItem(key(activityId))) ?? '[]');
    const seen = new Set(cur.map((p: RawPoint) => p.t));
    const next = [...cur, ...points.filter((p) => !seen.has(p.t))];
    cache.set(activityId, next);
    await AsyncStorage.setItem(key(activityId), JSON.stringify(next));
  },
  async all(activityId) {
    return (
      cache.get(activityId) ?? JSON.parse((await AsyncStorage.getItem(key(activityId))) ?? '[]')
    );
  },
  async clear(activityId) {
    cache.delete(activityId);
    await AsyncStorage.removeItem(key(activityId));
  },
};

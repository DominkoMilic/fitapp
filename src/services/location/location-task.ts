/**
 * Background location task (spec 11.2–11.3). Defined at module load (imported by the root layout)
 * so the OS can wake the app and deliver points while the screen is locked. Points go straight
 * to the durable buffer; the UI rebuilds stats from it.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { LocationObject } from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';

import type { RawPoint } from '@/domain/activity/gps-filter';

import { pointBuffer } from './point-buffer';

export const LOCATION_TASK = 'pace-activity-location';
/** Id of the activity being recorded; read by the task (no React state in background). */
export const ACTIVE_RECORDING_KEY = 'pace.active-recording-id';

export const toRawPoint = (l: LocationObject): RawPoint => ({
  t: l.timestamp,
  lat: l.coords.latitude,
  lng: l.coords.longitude,
  alt: l.coords.altitude ?? null,
  acc: l.coords.accuracy ?? null,
});

if (Platform.OS !== 'web' && !TaskManager.isTaskDefined(LOCATION_TASK)) {
  TaskManager.defineTask<{ locations?: LocationObject[] }>(
    LOCATION_TASK,
    async ({ data, error }) => {
      if (error || !data?.locations?.length) return;
      try {
        const id = await AsyncStorage.getItem(ACTIVE_RECORDING_KEY);
        if (!id) return;
        await pointBuffer.append(id, data.locations.filter((l) => !l.mocked).map(toRawPoint));
      } catch {
        // Never throw from a background task; the next delivery will try again.
      }
    },
  );
}

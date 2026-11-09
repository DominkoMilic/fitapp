/**
 * Starts/stops location updates for a recording (spec 11.2, 11.3).
 * - Background permission granted (native): a background task with an Android foreground service.
 * - Otherwise (or on web): foreground updates only; the UI says tracking pauses when backgrounded.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { Platform } from 'react-native';

import type { ActivityType } from '@/domain/activity/met';

import { ACTIVE_RECORDING_KEY, LOCATION_TASK, toRawPoint } from './location-task';
import { pointBuffer } from './point-buffer';

export type TrackingMode = 'background' | 'foreground';

let foregroundSub: Location.LocationSubscription | null = null;

const options = (type: ActivityType) => ({
  accuracy: type === 'run' ? Location.Accuracy.BestForNavigation : Location.Accuracy.High,
  timeInterval: 2000,
  distanceInterval: 5,
});

export async function permissionState() {
  const fg = await Location.getForegroundPermissionsAsync();
  const bg =
    Platform.OS === 'web' ? { granted: false } : await Location.getBackgroundPermissionsAsync();
  return { foreground: fg.granted, canAskForeground: fg.canAskAgain, background: bg.granted };
}

export const requestForeground = () =>
  Location.requestForegroundPermissionsAsync().then((r) => r.granted);
export const requestBackground = () =>
  Platform.OS === 'web'
    ? Promise.resolve(false)
    : Location.requestBackgroundPermissionsAsync().then((r) => r.granted);

/** Reduced ("approximate") accuracy makes distances unreliable (spec 28.6 #3). */
export async function isApproximateOnly(): Promise<boolean> {
  const p = await Location.getForegroundPermissionsAsync();
  return (p.ios?.accuracy ?? 'full') === 'reduced' || p.android?.accuracy === 'coarse';
}

export async function startTracking(activityId: string, type: ActivityType): Promise<TrackingMode> {
  await AsyncStorage.setItem(ACTIVE_RECORDING_KEY, activityId);
  const { background } = await permissionState();
  if (Platform.OS !== 'web' && background) {
    if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK)) return 'background';
    await Location.startLocationUpdatesAsync(LOCATION_TASK, {
      ...options(type),
      activityType: Location.ActivityType.Fitness,
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'PACE is recording',
        notificationBody: `Your ${type === 'cycle' ? 'ride' : type} is being tracked.`,
        notificationColor: '#34D399',
      },
    });
    return 'background';
  }
  foregroundSub?.remove();
  foregroundSub = await Location.watchPositionAsync(options(type), (l) => {
    void pointBuffer.append(activityId, [toRawPoint(l)]);
  });
  return 'foreground';
}

export async function stopTracking(): Promise<void> {
  foregroundSub?.remove();
  foregroundSub = null;
  if (Platform.OS !== 'web') {
    try {
      if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK))
        await Location.stopLocationUpdatesAsync(LOCATION_TASK);
    } catch {
      // Already stopped (e.g. after an OS kill).
    }
  }
  await AsyncStorage.removeItem(ACTIVE_RECORDING_KEY);
}

/** Current fix for the "acquiring GPS" screen. */
export async function watchAccuracy(
  onFix: (accuracyM: number | null) => void,
): Promise<() => void> {
  const sub = await Location.watchPositionAsync(
    { accuracy: Location.Accuracy.High, timeInterval: 2000, distanceInterval: 0 },
    (l) => onFix(l.coords.accuracy ?? null),
  );
  return () => sub.remove();
}

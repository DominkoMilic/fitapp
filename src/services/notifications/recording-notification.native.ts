import * as Notifications from 'expo-notifications';
import { AndroidImportance, AndroidNotificationVisibility } from 'expo-notifications';
import { Platform } from 'react-native';

/**
 * The notification shown while a walk, run or ride is recorded (spec 11.6): moving time,
 * distance and pace, with Pause (works without opening the app) or Resume / Finish. It is
 * re-posted with every update, so swiping it away while recording only hides it for a moment.
 */
export const RECORDING_CATEGORY = {
  active: 'recording-active',
  paused: 'recording-paused',
} as const;
export const RECORDING_ACTION = { pause: 'pause', resume: 'resume', finish: 'finish' } as const;

const ID = 'pace-recording';
const CHANNEL = 'recording';
// expo-location's foreground-service channel (package + task name).
const LOCATION_CHANNEL = 'app.pace.fitness.preview:pace-activity-location';

let setup: Promise<unknown> | null = null;
const ensureSetup = () =>
  (setup ??= Promise.all([
    Platform.OS === 'android'
      ? Notifications.setNotificationChannelAsync(CHANNEL, {
          name: 'Recording',
          importance: AndroidImportance.LOW,
          sound: null,
          vibrationPattern: null,
          enableVibrate: false,
          lockscreenVisibility: AndroidNotificationVisibility.PUBLIC,
          showBadge: false,
        })
      : null,
    Notifications.setNotificationCategoryAsync(RECORDING_CATEGORY.active, [
      {
        identifier: RECORDING_ACTION.pause,
        buttonTitle: 'Pause',
        options: { opensAppToForeground: false },
      },
    ]),
    // Android can't start location tracking from the background, so Resume opens the app.
    Notifications.setNotificationCategoryAsync(RECORDING_CATEGORY.paused, [
      {
        identifier: RECORDING_ACTION.resume,
        buttonTitle: 'Resume',
        options: { opensAppToForeground: true },
      },
      {
        identifier: RECORDING_ACTION.finish,
        buttonTitle: 'Finish',
        options: { opensAppToForeground: true },
      },
    ]),
  ]).catch(() => undefined));

/** The system's own "using location" notification sits silently at the bottom; ours is the main one. */
export async function quietLocationChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(LOCATION_CHANNEL, {
    name: 'Location in use',
    importance: AndroidImportance.MIN,
    sound: null,
    enableVibrate: false,
    showBadge: false,
  }).catch(() => undefined);
}

export async function showRecordingNotification(n: {
  title: string;
  body: string;
  paused: boolean;
}): Promise<void> {
  await ensureSetup();
  await Notifications.scheduleNotificationAsync({
    identifier: ID,
    content: {
      title: n.title,
      body: n.body,
      sticky: true,
      autoDismiss: false,
      color: '#34D399',
      categoryIdentifier: n.paused ? RECORDING_CATEGORY.paused : RECORDING_CATEGORY.active,
      data: { href: '/activity/track', pace: 'recording' },
      priority: Notifications.AndroidNotificationPriority.LOW,
    },
    trigger: Platform.OS === 'android' ? { channelId: CHANNEL } : null,
  });
}

/** Whether the recording notification is on screen (not swiped away). */
export async function isRecordingNotificationShown(): Promise<boolean> {
  try {
    const shown = await Notifications.getPresentedNotificationsAsync();
    return shown.some((n) => n.request.identifier === ID);
  } catch {
    return false;
  }
}

export async function clearRecordingNotification(): Promise<void> {
  await Notifications.dismissNotificationAsync(ID).catch(() => undefined);
  await Notifications.cancelScheduledNotificationAsync(ID).catch(() => undefined);
}

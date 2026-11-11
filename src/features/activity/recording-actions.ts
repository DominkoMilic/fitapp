/**
 * Pause / Resume / Finish from the recording notification (spec 11.6). Defined at module load
 * (imported by the root layout): Pause runs in the background without opening the app (Android
 * runs this task headlessly); Resume and Finish open the app, which then acts.
 */
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';

import { RECORDING_ACTION } from '@/services/notifications/recording-notification';

import { recorder } from './recorder';
import { useRecordingStore } from './recording-store';

const TASK = 'pace-recording-actions';

async function act(action: string, inApp: boolean) {
  // In the background the store may not be loaded from storage yet.
  await useRecordingStore.persist.rehydrate();
  if (!useRecordingStore.getState().rec) return;
  if (action === RECORDING_ACTION.pause) await recorder.pause();
  else if (action === RECORDING_ACTION.resume) {
    await recorder.resume();
    if (inApp) router.push('/activity/track');
  } else if (action === RECORDING_ACTION.finish) {
    await recorder.stop();
    if (inApp) router.push('/activity/summary');
  }
}

const isRecordingAction = (r: Notifications.NotificationResponse) =>
  r.notification.request.content.data?.pace === 'recording' &&
  r.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER;

if (Platform.OS !== 'web') {
  if (!TaskManager.isTaskDefined(TASK)) {
    TaskManager.defineTask<Notifications.NotificationTaskPayload>(TASK, async ({ data }) => {
      try {
        // Only Pause runs here; Resume and Finish open the app, whose listener handles them.
        if (data && 'actionIdentifier' in data && data.actionIdentifier === RECORDING_ACTION.pause)
          await act(RECORDING_ACTION.pause, false);
      } catch {
        // Never throw from a background task.
      }
    });
    void Notifications.registerTaskAsync(TASK).catch(() => undefined);
  }
  // App open (or opened by Resume / Finish).
  Notifications.addNotificationResponseReceivedListener((r) => {
    if (isRecordingAction(r)) void act(r.actionIdentifier, true).catch(() => undefined);
  });
}

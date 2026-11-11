import * as Notifications from 'expo-notifications';
import { AndroidImportance, IosAuthorizationStatus } from 'expo-notifications';
import { Platform } from 'react-native';

import type { Notifier, PermissionState } from './notifier.types';

const KIND = { reminder: 'reminder', rest: 'rest' } as const;
const REST_ID = 'pace-rest-end';
const CHANNEL = 'reminders';
let handled: string | null = null;

Notifications.setNotificationHandler({
  handleNotification: async (n) => ({
    // Rest-over shows even in the foreground; reminders while using the app are shown too.
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: n.request.content.data?.pace === KIND.rest,
    shouldSetBadge: false,
  }),
});

// Social pushes (cheers, comments, friend requests) arrive on the "social" channel; Android drops
// a push whose channel doesn't exist yet, so it is created as soon as the app starts.
if (Platform.OS === 'android')
  void Notifications.setNotificationChannelAsync('social', {
    name: 'Friends',
    importance: AndroidImportance.HIGH,
  }).catch(() => undefined);

let channelReady: Promise<unknown> | null = null;
const ensureChannel = () =>
  Platform.OS === 'android'
    ? (channelReady ??= Notifications.setNotificationChannelAsync(CHANNEL, {
        name: 'Reminders',
        importance: AndroidImportance.DEFAULT,
      }))
    : Promise.resolve();

const state = (p: Notifications.NotificationPermissionsStatus): PermissionState =>
  p.granted || p.ios?.status === IosAuthorizationStatus.PROVISIONAL
    ? 'granted'
    : p.canAskAgain
      ? 'undetermined'
      : 'denied';

const dateTrigger = (at: number): Notifications.NotificationTriggerInput => ({
  type: Notifications.SchedulableTriggerInputTypes.DATE,
  date: new Date(at),
  channelId: CHANNEL,
});

export const notifier: Notifier = {
  permission: async () => state(await Notifications.getPermissionsAsync()),
  request: async () => state(await Notifications.requestPermissionsAsync()),

  async reconcile(reminders) {
    await ensureChannel();
    await this.cancelAllReminders();
    const now = Date.now();
    let n = 0;
    for (const r of reminders) {
      if (r.at <= now) continue;
      await Notifications.scheduleNotificationAsync({
        identifier: r.id,
        content: { title: r.title, body: r.body, data: { pace: KIND.reminder, href: r.href } },
        trigger: dateTrigger(r.at),
      });
      n++;
    }
    return n;
  },

  async cancelAllReminders() {
    const all = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      all
        .filter((s) => s.content.data?.pace === KIND.reminder)
        .map((s) => Notifications.cancelScheduledNotificationAsync(s.identifier)),
    );
  },

  async scheduleRestEnd(at) {
    if (at <= Date.now()) return;
    await ensureChannel();
    await Notifications.cancelScheduledNotificationAsync(REST_ID).catch(() => undefined);
    await Notifications.scheduleNotificationAsync({
      identifier: REST_ID,
      content: {
        title: 'Rest over',
        body: 'Time for your next set.',
        data: { pace: KIND.rest, href: '/training/session' },
      },
      trigger: dateTrigger(at),
    });
  },
  cancelRestEnd: () =>
    Notifications.cancelScheduledNotificationAsync(REST_ID).catch(() => undefined),

  onTap(cb) {
    const open = (res: Notifications.NotificationResponse | null) => {
      // Action buttons (e.g. Pause on the recording notification) are handled where they live.
      if (res && res.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
      const href = res?.notification.request.content.data?.href;
      if (typeof href === 'string' && href.startsWith('/')) cb(href);
    };
    // A tap that launched the app from closed is delivered once here.
    void Notifications.getLastNotificationResponseAsync().then((res) => {
      if (res && res.notification.request.identifier !== handled) {
        handled = res.notification.request.identifier;
        open(res);
      }
    });
    const sub = Notifications.addNotificationResponseReceivedListener((res) => {
      handled = res.notification.request.identifier;
      open(res);
    });
    return () => sub.remove();
  },
};

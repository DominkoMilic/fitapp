import type { Notifier } from './notifier.types';

/** Web: local notifications aren't scheduled; reminders are in-app only. */
export const notifier: Notifier = {
  permission: async () => 'unsupported',
  request: async () => 'unsupported',
  exactAlarm: async () => 'unsupported',
  requestExactAlarm: async () => 'unsupported',
  reconcile: async () => 0,
  cancelAllReminders: async () => undefined,
  scheduleRestEnd: async () => undefined,
  cancelRestEnd: async () => undefined,
  onTap: () => () => undefined,
};

export type PermissionState = 'granted' | 'denied' | 'undetermined' | 'unsupported';

export interface ScheduledReminder {
  id: string;
  at: number;
  title: string;
  body: string;
  href: string;
}

export interface Notifier {
  permission(): Promise<PermissionState>;
  request(): Promise<PermissionState>;
  /** Cancels every PACE reminder and schedules these (spec 17 reconciliation). */
  reconcile(reminders: readonly ScheduledReminder[]): Promise<number>;
  cancelAllReminders(): Promise<void>;
  scheduleRestEnd(at: number): Promise<void>;
  cancelRestEnd(): Promise<void>;
  /** Calls back with the deep link when the user taps a notification. */
  onTap(cb: (href: string) => void): () => void;
}

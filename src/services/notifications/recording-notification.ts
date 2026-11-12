/** Web: no system notification while recording. */
export const RECORDING_CATEGORY = {
  active: 'recording-active',
  paused: 'recording-paused',
} as const;
export const RECORDING_ACTION = { pause: 'pause', resume: 'resume', finish: 'finish' } as const;

export const hasLiveClock = (): boolean => false;

export async function updateRecordingNotification(_: {
  title: string;
  body: string;
  chronometerBase: number | null;
}): Promise<boolean> {
  return false;
}

export async function showRecordingNotification(_: {
  title: string;
  body: string;
  paused: boolean;
  chronometerBase?: number | null;
}): Promise<void> {}

export async function clearRecordingNotification(): Promise<void> {}

export async function isRecordingNotificationShown(): Promise<boolean> {
  return false;
}

export async function quietLocationChannel(): Promise<void> {}

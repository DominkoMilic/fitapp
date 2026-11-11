/** Web: no system notification while recording. */
export const RECORDING_CATEGORY = {
  active: 'recording-active',
  paused: 'recording-paused',
} as const;
export const RECORDING_ACTION = { pause: 'pause', resume: 'resume', finish: 'finish' } as const;

export async function showRecordingNotification(_: {
  title: string;
  body: string;
  paused: boolean;
}): Promise<void> {}

export async function clearRecordingNotification(): Promise<void> {}

export async function quietLocationChannel(): Promise<void> {}

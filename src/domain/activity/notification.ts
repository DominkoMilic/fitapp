import type { ActivityType } from './met';
import { formatDistance, formatPace, formatSpeed } from './geo';

const NAME: Record<ActivityType, string> = {
  walk: 'Walk',
  run: 'Run',
  cycle: 'Ride',
  other: 'Activity',
};

const clock = (seconds: number) => {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
};

/**
 * Text of the recording notification (spec 11.6): the moving time and distance, with the current
 * pace (speed for rides). Never a location: it can show on the lock screen. Pure.
 */
export function recordingNotificationText(input: {
  type: ActivityType;
  movingS: number;
  distanceM: number;
  currentPaceSPerKm: number | null;
  currentSpeedMps: number;
  unit: 'metric' | 'imperial';
  paused: boolean;
}): { title: string; body: string } {
  const distance = formatDistance(input.distanceM, input.unit);
  const title = `${NAME[input.type]} · ${clock(input.movingS)}`;
  if (input.paused) return { title, body: `Paused · ${distance}` };
  const now =
    input.type === 'cycle'
      ? formatSpeed(input.currentSpeedMps, input.unit)
      : input.currentPaceSPerKm
        ? `${formatPace(input.currentPaceSPerKm, input.unit)} ${input.unit === 'metric' ? '/km' : '/mi'}`
        : null;
  return { title, body: now ? `${distance} · ${now}` : distance };
}

import { chronometerBase, recordingNotificationText } from '@/domain/activity/notification';

const base = {
  movingS: 754,
  distanceM: 1420,
  currentPaceSPerKm: 372,
  currentSpeedMps: 0,
  unit: 'metric' as const,
  paused: false,
};

describe('recording notification text', () => {
  it('shows moving time, distance and current pace for a walk or run', () => {
    expect(recordingNotificationText({ ...base, type: 'walk' })).toEqual({
      title: 'Walk · 12:34',
      body: '1.42 km · 6:12 /km',
    });
  });

  it('shows speed for a ride and hours for long sessions', () => {
    expect(
      recordingNotificationText({ ...base, type: 'cycle', movingS: 3725, currentSpeedMps: 7 }),
    ).toEqual({ title: 'Ride · 1:02:05', body: '1.42 km · 25.2 km/h' });
  });

  it('says paused, and uses miles when imperial', () => {
    expect(
      recordingNotificationText({ ...base, type: 'run', paused: true, unit: 'imperial' }),
    ).toEqual({ title: 'Run · 12:34', body: 'Paused · 0.88 mi' });
  });

  it('leaves out the pace while there is none yet', () => {
    expect(recordingNotificationText({ ...base, type: 'walk', currentPaceSPerKm: null }).body).toBe(
      '1.42 km',
    );
  });

  it('leaves the time to the system clock while recording, keeps it in the title when paused', () => {
    expect(recordingNotificationText({ ...base, type: 'run', liveClock: true }).title).toBe('Run');
    expect(
      recordingNotificationText({ ...base, type: 'run', liveClock: true, paused: true }).title,
    ).toBe('Run · 12:34');
  });
});

describe('chronometer base', () => {
  it('is start + time paused, so now − base is the moving time', () => {
    const r = { status: 'recording', startedAt: 1_000_000, pausedMs: 30_000 };
    const now = 1_000_000 + 754_000 + 30_000;
    expect((now - chronometerBase(r)!) / 1000).toBe(754);
  });
  it('stops (null) while paused', () => {
    expect(chronometerBase({ status: 'paused', startedAt: 1, pausedMs: 0 })).toBeNull();
  });
});

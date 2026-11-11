import { recordingNotificationText } from '@/domain/activity/notification';

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
    expect(
      recordingNotificationText({ ...base, type: 'walk', currentPaceSPerKm: null }).body,
    ).toBe('1.42 km');
  });
});

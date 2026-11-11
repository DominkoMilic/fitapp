import { useEffect, useState } from 'react';
import { Linking } from 'react-native';

import { Banner, ErrorState, LoadingState, useToast } from '@/components/feedback';
import { Button, SectionHeader, Screen, SegmentedControl, Text, Toggle } from '@/components/ui';
import { TimeField } from '@/components/forms/TimeField';
import type { NotificationPrefs } from '@/domain/notifications/planner';
import { useSaveNotificationPrefs } from '@/features/notifications/api';
import {
  isAllowedTime,
  readPrefs,
  REMINDER_EARLIEST,
  REMINDER_LATEST,
} from '@/features/notifications/prefs';
import { usePreferences } from '@/features/profile/api';
import { notifier } from '@/services/notifications/notifier';
import type { PermissionState } from '@/services/notifications/notifier.types';

export default function NotificationSettings() {
  const prefsQuery = usePreferences();
  if (prefsQuery.isPending)
    return (
      <Screen edges={['bottom']}>
        <LoadingState />
      </Screen>
    );
  if (prefsQuery.isError)
    return (
      <Screen edges={['bottom']}>
        <ErrorState
          message="Your reminder settings could not be loaded."
          onRetry={() => void prefsQuery.refetch()}
        />
      </Screen>
    );
  return <Form initial={readPrefs(prefsQuery.data?.notification_preferences)} />;
}

function Form({ initial }: { initial: NotificationPrefs }) {
  const save = useSaveNotificationPrefs();
  const showToast = useToast((s) => s.show);
  const [prefs, setPrefs] = useState<NotificationPrefs>(initial);
  const [permission, setPermission] = useState<PermissionState>('undetermined');
  const [weighIn, setWeighIn] = useState(initial.weighIn.time);
  const [timeError, setTimeError] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void notifier.permission().then(setPermission, () => undefined);
  }, []);

  /** Permission is asked only when a reminder is switched on (spec 17). */
  const turnOn = async (next: NotificationPrefs) => {
    setPrefs(next);
    if (permission === 'undetermined') setPermission(await notifier.request());
  };
  const toggle = (key: keyof NotificationPrefs) => (on: boolean) => {
    const next = { ...prefs, [key]: { ...prefs[key], on } } as NotificationPrefs;
    if (on) void turnOn(next);
    else setPrefs(next);
  };

  const onSave = () => {
    // Checked on the field itself; a time saved before quiet hours changed can be out of range.
    if (prefs.weighIn.on && !isAllowedTime(weighIn))
      return setTimeError('Pick a time between 06:00 and 21:55 (quiet hours are 22:00–06:00).');
    setTimeError(undefined);
    setError(null);
    const next: NotificationPrefs = {
      ...prefs,
      weighIn: { ...prefs.weighIn, time: weighIn },
    };
    save.mutate(next, {
      onSuccess: () => {
        setPrefs(next);
        showToast('Reminders saved');
      },
      onError: () => setError('Could not save. Check your connection.'),
    });
  };

  return (
    <Screen locked={save.isPending} edges={['bottom']}>
      {permission === 'unsupported' ? (
        <Banner message="Reminders are delivered by the PACE mobile app. Your choices here are saved and used on your phone." />
      ) : permission === 'denied' ? (
        <>
          <Banner
            tone="warning"
            message="Notifications are turned off for PACE, so reminders show only inside the app. Turn them on in your phone's Settings."
          />
          <Button
            title="Open Settings"
            variant="secondary"
            onPress={() => void Linking.openSettings()}
          />
        </>
      ) : null}

      <SectionHeader title="Training" />
      <Toggle
        label="Workout reminder"
        description="Before each planned workout (09:00 if it has no time). Not on rest days."
        value={prefs.workout.on}
        onChange={toggle('workout')}
      />
      {prefs.workout.on ? (
        <SegmentedControl
          options={[
            { value: '30', label: '30 min' },
            { value: '60', label: '1 hour' },
            { value: '120', label: '2 hours' },
          ]}
          value={String(prefs.workout.minutesBefore) as '30' | '60' | '120'}
          onChange={(v) =>
            setPrefs({ ...prefs, workout: { ...prefs.workout, minutesBefore: Number(v) } })
          }
          accessibilityLabel="How long before the workout"
        />
      ) : null}
      <Toggle
        label="Game reminder"
        description="The evening before a game, match or race, at 19:00."
        value={prefs.match.on}
        onChange={toggle('match')}
      />

      <SectionHeader title="Daily" />
      <Toggle label="Weigh-in reminder" value={prefs.weighIn.on} onChange={toggle('weighIn')} />
      {prefs.weighIn.on ? (
        <TimeField
          label="Time"
          value={weighIn}
          onChange={(t) => {
            setWeighIn(t);
            setTimeError(undefined);
          }}
          min={REMINDER_EARLIEST}
          max={REMINDER_LATEST}
          error={timeError}
        />
      ) : null}

      <SectionHeader title="Reports" />
      <Toggle
        label="Weekly report"
        description="At 09:00 on the first day of your week."
        value={prefs.weeklyReport.on}
        onChange={toggle('weeklyReport')}
      />

      <Text variant="caption" color="textSecondary">
        At most 4 reminders a day, none between 22:00 and 06:00. Reminders never show your weight or
        health details on the lock screen. The rest timer alerts you during workouts.
      </Text>
      {error ? <Banner tone="danger" message={error} /> : null}
      <Button title="Save" loading={save.isPending} onPress={onSave} />
    </Screen>
  );
}

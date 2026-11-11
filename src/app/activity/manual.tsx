import { randomUUID } from 'expo-crypto';
import { useState } from 'react';

import { Banner, useToast } from '@/components/feedback';
import { useFieldErrors } from '@/hooks/useFieldErrors';
import { Button, NumberField, Screen, SegmentedControl, Text, TextField } from '@/components/ui';
import { manualSummary, validateManualFields } from '@/domain/activity/manual';
import type { ActivityType } from '@/domain/activity/met';
import { useActivityActions } from '@/features/activity/api';
import { ACTIVITY_LABEL } from '@/features/activity/labels';
import { useToday } from '@/features/dashboard/useToday';
import { DateField } from '@/features/onboarding/components/DateField';
import { backToActivities } from '@/features/activity/navigation';
import { useProfile } from '@/features/profile/api';
import { useWeightStats } from '@/features/weight/useWeightStats';

const TYPES = [
  { value: 'walk', label: 'Walk' },
  { value: 'run', label: 'Run' },
  { value: 'cycle', label: 'Ride' },
  { value: 'other', label: 'Other' },
] as const;

/** Add an activity without GPS (spec 11.8), e.g. a treadmill run or a forgotten recording. */
export default function ManualActivity() {
  const { today } = useToday();
  const { data: profile } = useProfile();
  const { current } = useWeightStats('30D');
  const { save } = useActivityActions();
  const showToast = useToast((s) => s.show);
  const unit = (profile?.unit_system ?? 'metric') as 'metric' | 'imperial';
  const [type, setType] = useState<ActivityType>('walk');
  const [date, setDate] = useState<string | null>(today);
  const [minutes, setMinutes] = useState<number | null>(30);
  const [distance, setDistance] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fields = useFieldErrors<'date' | 'minutes' | 'distance'>();

  const onSave = async () => {
    setError(null);
    const km = distance === null ? null : unit === 'metric' ? distance : distance * 1.609344;
    const ok = fields.show({
      ...(!date || date > today ? { date: 'Choose today or a past date' } : {}),
      ...validateManualFields(minutes, km),
    });
    if (!ok || !date) return;
    setSaving(true);
    const endedAt = date === today ? Date.now() : Date.parse(`${date}T12:00:00Z`);
    const summary = manualSummary({
      type,
      endedAt,
      minutes: minutes as number,
      distanceKm: km,
      weightKg: current?.kg ?? null,
    });
    try {
      await save({
        id: randomUUID(),
        summary,
        track: null,
        localDate: date,
        source: 'manual',
        notes: notes.trim() ? notes.trim().slice(0, 1000) : null,
      });
      showToast(`${ACTIVITY_LABEL[type]} added`);
      backToActivities();
    } catch {
      setError('Could not save. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen locked={saving} edges={['bottom']}>
      <SegmentedControl
        options={TYPES}
        value={type}
        onChange={setType}
        accessibilityLabel="Activity type"
      />
      <DateField
        max={today}
        label="Date"
        value={date}
        onChange={(v) => {
          setDate(v);
          fields.clear('date');
        }}
        error={fields.errors.date}
      />
      <NumberField
        label="Duration"
        suffix="min"
        decimal={false}
        value={minutes}
        onChangeValue={(v) => {
          setMinutes(v);
          fields.clear('minutes');
        }}
        error={fields.errors.minutes}
      />
      <NumberField
        label="Distance (optional)"
        suffix={unit === 'metric' ? 'km' : 'mi'}
        precision={2}
        value={distance}
        onChangeValue={(v) => {
          setDistance(v);
          fields.clear('distance');
        }}
        error={fields.errors.distance}
      />
      <TextField
        label="Notes (optional)"
        value={notes}
        onChangeText={setNotes}
        maxLength={1000}
        multiline
      />
      <Text variant="caption" color="textSecondary">
        Add a distance to get a calorie estimate (based on your speed and latest weight).
      </Text>
      {error ? <Banner tone="danger" message={error} /> : null}
      <Button title="Save activity" loading={saving} onPress={() => void onSave()} />
    </Screen>
  );
}

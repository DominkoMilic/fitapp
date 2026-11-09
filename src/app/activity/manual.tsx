import { randomUUID } from 'expo-crypto';
import { router } from 'expo-router';
import { useState } from 'react';

import { Banner, useToast } from '@/components/feedback';
import { Button, NumberField, Screen, SegmentedControl, Text, TextField } from '@/components/ui';
import { manualSummary, validateManual } from '@/domain/activity/manual';
import type { ActivityType } from '@/domain/activity/met';
import { useActivityActions } from '@/features/activity/api';
import { ACTIVITY_LABEL } from '@/features/activity/labels';
import { useToday } from '@/features/dashboard/useToday';
import { DateField } from '@/features/onboarding/components/DateField';
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

  const onSave = async () => {
    if (!date || date > today) return setError('Choose today or a past date');
    const km = distance === null ? null : unit === 'metric' ? distance : distance * 1.609344;
    const invalid = validateManual(minutes, km);
    if (invalid) return setError(invalid);
    setError(null);
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
      router.back();
    } catch {
      setError('Could not save. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen edges={['bottom']}>
      <SegmentedControl
        options={TYPES}
        value={type}
        onChange={setType}
        accessibilityLabel="Activity type"
      />
      <DateField label="Date" value={date} onChange={setDate} />
      <NumberField
        label="Duration"
        suffix="min"
        decimal={false}
        value={minutes}
        onChangeValue={setMinutes}
      />
      <NumberField
        label="Distance (optional)"
        suffix={unit === 'metric' ? 'km' : 'mi'}
        precision={2}
        value={distance}
        onChangeValue={setDistance}
      />
      <TextField
        label="Notes (optional)"
        value={notes}
        onChangeText={setNotes}
        maxLength={1000}
        multiline
      />
      <Text variant="caption" color="textSecondary">
        Calories are an estimate based on your latest weight.
      </Text>
      {error ? <Banner tone="danger" message={error} /> : null}
      <Button title="Save activity" loading={saving} onPress={() => void onSave()} />
    </Screen>
  );
}

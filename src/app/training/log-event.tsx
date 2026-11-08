import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { Banner, useToast } from '@/components/feedback';
import { Button, ChipGroup, NumberField, Screen, Text, TextField } from '@/components/ui';
import { estimateCalories, sessionMet } from '@/domain/training/session';
import { useToday } from '@/features/dashboard/useToday';
import { DateField } from '@/features/onboarding/components/DateField';
import { useRestrictions } from '@/features/training/library';
import { useScheduledWorkout } from '@/features/training/schedule-api';
import { useSaveSession } from '@/features/training/session-api';
import { useWeightStats } from '@/features/weight/useWeightStats';

type Category =
  'futsal_match' | 'futsal_practice' | 'football_match' | 'football_practice' | 'other';

/** Logs a match, practice or other activity with duration and RPE (spec 10.4, sport events). */
export default function LogEvent() {
  const { scheduledId } = useLocalSearchParams<{ scheduledId?: string }>();
  const { today } = useToday();
  const { workout: scheduled } = useScheduledWorkout(scheduledId);
  const restrictions = useRestrictions();
  const { current } = useWeightStats('30D');
  const save = useSaveSession();
  const showToast = useToast((s) => s.show);
  const [category, setCategory] = useState<Category>(
    (scheduled?.category as Category) ?? 'futsal_match',
  );
  const [title, setTitle] = useState(scheduled?.title ?? '');
  const [date, setDate] = useState<string | null>(scheduled?.scheduled_date ?? today);
  const [minutes, setMinutes] = useState<number | null>(
    scheduled?.estimated_duration_minutes ?? 60,
  );
  const [rpe, setRpe] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const onSave = async () => {
    if (!date || date > today) return setError('Choose today or a past date');
    if (!minutes || minutes < 1 || minutes > 300) return setError('Duration must be 1–300 minutes');
    if (rpe === null) return setError('How hard was it? Choose 0–10');
    setError(null);
    setSaving(true);
    const seconds = minutes * 60;
    const end = new Date(date === today ? Date.now() : Date.parse(`${date}T20:00:00Z`));
    const start = new Date(end.getTime() - seconds * 1000);
    try {
      await save({
        scheduled: scheduled ?? null,
        templateSlug: null,
        title:
          title.trim() ||
          {
            futsal_match: 'Futsal match',
            futsal_practice: 'Futsal practice',
            football_match: 'Football match',
            football_practice: 'Football practice',
            other: 'Activity',
          }[category],
        category,
        startedAt: start.toISOString(),
        endedAt: end.toISOString(),
        localDate: date,
        durationSeconds: seconds,
        pausedSeconds: 0,
        rpe,
        feeling: null,
        volumeKg: null,
        calories: current
          ? estimateCalories(sessionMet({ category, intensity: 'hard' }), current.kg, seconds)
          : null,
        completion: 'completed',
        source: 'manual',
        notes: notes.trim() || null,
        sets: [],
      });
      router.back();
      showToast('Session logged');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen
      edges={['bottom']}
      footer={<Button title="Save" loading={saving} onPress={() => void onSave()} />}
    >
      {error ? <Banner tone="danger" message={error} /> : null}
      {restrictions.sportRestricted && category !== 'other' ? (
        <Banner
          tone="warning"
          message="Your injury isn't marked as cleared for sport. Logging is fine; consider professional advice before your next match."
        />
      ) : null}
      <ChipGroup
        accessibilityLabel="Type"
        options={[
          { value: 'futsal_match', label: 'Futsal match' },
          { value: 'futsal_practice', label: 'Futsal practice' },
          { value: 'football_match', label: 'Football match' },
          { value: 'football_practice', label: 'Football practice' },
          { value: 'other', label: 'Other' },
        ]}
        selected={[category]}
        onToggle={setCategory}
      />
      <TextField label="Name (optional)" value={title} onChangeText={setTitle} maxLength={80} />
      <DateField label="Date" value={date} onChange={setDate} />
      <NumberField
        label="Duration"
        suffix="min"
        decimal={false}
        precision={0}
        value={minutes}
        onChangeValue={setMinutes}
      />
      <Text variant="small" color="textSecondary">
        How hard was it? (0 = rest, 10 = maximal)
      </Text>
      <ChipGroup
        accessibilityLabel="Effort (RPE)"
        options={Array.from({ length: 11 }, (_, n) => ({ value: String(n), label: String(n) }))}
        selected={rpe === null ? [] : [String(rpe)]}
        onToggle={(v) => setRpe(Number(v))}
      />
      <TextField
        label="Notes (optional)"
        value={notes}
        onChangeText={setNotes}
        maxLength={1000}
        multiline
      />
      <Text variant="caption" color="textSecondary">
        Calories are estimated from duration and type, not measured.
      </Text>
    </Screen>
  );
}

import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { goBack } from '@/navigation/back';
import { Banner, useToast } from '@/components/feedback';
import { Button, ChipGroup, NumberField, Screen, Text, TextField } from '@/components/ui';
import { estimateCalories, sessionMet } from '@/domain/training/session';
import { useToday } from '@/features/dashboard/useToday';
import { DateField } from '@/features/onboarding/components/DateField';
import { useRestrictions } from '@/features/training/library';
import { useScheduledWorkout } from '@/features/training/schedule-api';
import { useSaveSession } from '@/features/training/session-api';
import { useWeightStats } from '@/features/weight/useWeightStats';
import { categoryLabel } from '@/domain/format';
import { parseSportCategory, sportCategory } from '@/domain/sports/catalogue';
import { CommitmentTypePicker } from '@/features/sports/CommitmentTypePicker';

/** Logs a game, practice or other activity with duration and RPE (spec 10.4, sport events). */
export default function LogEvent() {
  const { scheduledId } = useLocalSearchParams<{ scheduledId?: string }>();
  const { today } = useToday();
  const { workout: scheduled } = useScheduledWorkout(scheduledId);
  const restrictions = useRestrictions();
  const { current } = useWeightStats('30D');
  const save = useSaveSession();
  const showToast = useToast((s) => s.show);
  const firstSport = restrictions.sports[0];
  const [category, setCategory] = useState<string>(
    scheduled?.category ?? (firstSport ? sportCategory(firstSport, 'match') : 'other'),
  );
  // The scheduled item and the user's sports load after the first render: apply the default once
  // when they arrive, unless the user already picked something (adjusting state during render).
  const [defaulted, setDefaulted] = useState(false);
  const [touched, setTouched] = useState(false);
  const defaultCategory =
    scheduled?.category ?? (firstSport ? sportCategory(firstSport, 'match') : null);
  if (!defaulted && !touched && defaultCategory && (!scheduledId || scheduled)) {
    setDefaulted(true);
    if (defaultCategory !== category) setCategory(defaultCategory);
  }
  const sport = parseSportCategory(category)?.sport ?? null;
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
        title: title.trim() || categoryLabel(category) || 'Activity',
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
      goBack('/training');
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
      {sport && restrictions.restrictedFor(sport.key) ? (
        <Banner
          tone="warning"
          message={`Your injury isn't marked as cleared for ${sport.label.toLowerCase()}. Logging is fine; consider professional advice before your next ${sport.eventLabels.match.toLowerCase()}.`}
        />
      ) : null}
      <CommitmentTypePicker
        sports={restrictions.sports}
        value={category}
        onChange={(c) => {
          setTouched(true);
          setCategory(c);
        }}
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

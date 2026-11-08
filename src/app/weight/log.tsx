import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { Banner, ConfirmDialog, LoadingState, useToast } from '@/components/feedback';
import { Button, Screen, Text, TextField } from '@/components/ui';
import { LIMITS } from '@/constants/safety';
import { isValidIsoDate } from '@/domain/calculations/dates';
import type { UnitSystem } from '@/domain/calculations/units';
import { currentWeight, dailyValues, isSuspiciousWeight } from '@/domain/weight/trend';
import { useToday } from '@/features/dashboard/useToday';
import { DateField } from '@/features/onboarding/components/DateField';
import { WeightField } from '@/features/onboarding/components/MeasurementFields';
import { useProfile } from '@/features/profile/api';
import { useWeightActions, useWeightEntries } from '@/features/weight/api';

export default function LogWeight() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { entries, isPending } = useWeightEntries();
  const existing = id ? entries.find((e) => e.id === id) : undefined;
  if (id && isPending)
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  return <WeightForm key={existing?.id ?? 'new'} existing={existing} entries={entries} />;
}

function WeightForm({
  existing,
  entries,
}: {
  existing: ReturnType<typeof useWeightEntries>['entries'][number] | undefined;
  entries: ReturnType<typeof useWeightEntries>['entries'];
}) {
  const { today } = useToday();
  const { data: profile } = useProfile();
  const actions = useWeightActions();
  const showToast = useToast((s) => s.show);
  const unit = (profile?.unit_system ?? 'metric') as UnitSystem;
  const [weightKg, setWeightKg] = useState<number | null>(
    existing ? Number(existing.weight_kg) : null,
  );
  const [date, setDate] = useState<string | null>(existing?.local_date ?? today);
  const [note, setNote] = useState(existing?.note ?? '');
  const [error, setError] = useState<string | null>(null);
  const [confirmOutlier, setConfirmOutlier] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);

  const reference =
    currentWeight(dailyValues(entries.filter((e) => e.id !== existing?.id)))?.kg ?? null;

  const validate = (): string | null => {
    if (weightKg === null) return 'Enter your weight';
    if (weightKg < LIMITS.weightKg.min || weightKg > LIMITS.weightKg.max)
      return 'Weight must be between 30 and 350 kg';
    if (!date || !isValidIsoDate(date)) return 'Enter a valid date';
    if (date > today) return "You can't log a weight in the future";
    if (profile?.date_of_birth && date < profile.date_of_birth)
      return 'The date is before your date of birth';
    return null;
  };

  const save = async () => {
    setSaving(true);
    try {
      const savedId = await actions.save({
        id: existing?.id,
        weightKg: weightKg as number,
        localDate: date as string,
        note,
        measuredAt: existing && existing.local_date === date ? existing.measured_at : undefined,
      });
      router.back();
      if (!existing) {
        showToast('Weight saved', { label: 'Undo', onPress: () => void actions.remove(savedId) });
      }
    } catch {
      setError("Couldn't save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const onSave = () => {
    const problem = validate();
    setError(problem);
    if (problem) return;
    if (isSuspiciousWeight(weightKg as number, reference)) setConfirmOutlier(true);
    else void save();
  };

  return (
    <Screen
      edges={['bottom']}
      footer={
        <>
          <Button title="Save" loading={saving} onPress={onSave} />
          {existing ? (
            <Button title="Delete entry" variant="ghost" onPress={() => setConfirmDelete(true)} />
          ) : null}
        </>
      }
    >
      {error ? <Banner tone="danger" message={error} /> : null}
      <WeightField label="Weight" unitSystem={unit} value={weightKg} onChange={setWeightKg} />
      <DateField label="Date" value={date} onChange={setDate} />
      <TextField label="Note (optional)" value={note} onChangeText={setNote} maxLength={500} />
      <Text variant="caption" color="textSecondary">
        For a reliable trend, weigh yourself in the morning, after the toilet, before eating, in
        similar clothing. Daily changes of 1–2 kg are normal (water, food, salt). Your 7-day average
        shows the real trend.
      </Text>
      <ConfirmDialog
        visible={confirmOutlier}
        title="Is this correct?"
        message={`This is quite different from your recent average${reference ? ` (${reference.toFixed(1)} kg)` : ''}. Check for a typo before saving.`}
        confirmLabel="Save anyway"
        cancelLabel="Let me check"
        onCancel={() => setConfirmOutlier(false)}
        onConfirm={() => {
          setConfirmOutlier(false);
          void save();
        }}
      />
      <ConfirmDialog
        visible={confirmDelete}
        destructive
        title="Delete this entry?"
        message="It is removed from your history and chart. Milestones you already unlocked stay unlocked."
        confirmLabel="Delete"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => {
          if (existing) await actions.remove(existing.id);
          setConfirmDelete(false);
          router.back();
        }}
      />
    </Screen>
  );
}

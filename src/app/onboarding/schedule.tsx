import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { View } from 'react-native';

import { Banner } from '@/components/feedback';
import {
  Button,
  Card,
  ChipGroup,
  NumberField,
  SegmentedControl,
  Text,
  TextField,
} from '@/components/ui';
import {
  commitmentSchema,
  scheduleSchema,
  type ScheduleValues,
} from '@/domain/validation/onboarding';
import { OnboardingStep } from '@/features/onboarding/components/OnboardingStep';
import { WEEKDAYS } from '@/features/onboarding/constants';
import { useOnboardingDraft } from '@/features/onboarding/draft-store';
import { spacing } from '@/theme';

type Commitment = ScheduleValues['commitments'][number];

const CATEGORY_OPTIONS = [
  { value: 'futsal_match', label: 'Futsal match' },
  { value: 'futsal_practice', label: 'Futsal practice' },
  { value: 'football_match', label: 'Football match' },
  { value: 'football_practice', label: 'Football practice' },
  { value: 'other', label: 'Other' },
] as const;

const emptyCommitment = (): Commitment => ({
  title: '',
  category: 'futsal_match',
  weekday: 6,
  localTime: '18:00',
  durationMinutes: 60,
  intensity: 'hard',
});

export default function ScheduleStep() {
  const saved = useOnboardingDraft((s) => s.schedule);
  const save = useOnboardingDraft((s) => s.save);
  const [editing, setEditing] = useState<Commitment | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const { control, handleSubmit, setValue } = useForm<ScheduleValues>({
    resolver: zodResolver(scheduleSchema),
    defaultValues: saved ?? {
      trainingDaysPerWeek: 3,
      preferredDays: [],
      maxSessionMinutes: 45,
      preferredTime: null,
      commitments: [],
    },
  });
  const commitments = useWatch({ control, name: 'commitments' });

  const onContinue = handleSubmit((values) => {
    save('schedule', values);
    router.replace('/onboarding/nutrition');
  });

  const addCommitment = () => {
    if (!editing) return;
    const parsed = commitmentSchema.safeParse(editing);
    if (!parsed.success) {
      setEditError(parsed.error.issues[0]?.message ?? 'Check the details');
      return;
    }
    setValue('commitments', [...commitments, parsed.data], { shouldValidate: true });
    setEditing(null);
    setEditError(null);
  };

  return (
    <OnboardingStep
      step="schedule"
      title="Your week"
      subtitle="Matches and practices are fixed; PACE plans training around them."
      onContinue={() => void onContinue()}
    >
      <Text variant="small" color="textSecondary">
        Training sessions per week (besides sport)
      </Text>
      <Controller
        control={control}
        name="trainingDaysPerWeek"
        render={({ field }) => (
          <SegmentedControl
            accessibilityLabel="Training sessions per week"
            options={['0', '1', '2', '3', '4', '5'].map((v) => ({ value: v, label: v }))}
            value={String(field.value)}
            onChange={(v) => field.onChange(Number(v))}
          />
        )}
      />
      <Text variant="small" color="textSecondary">
        Preferred training days
      </Text>
      <Controller
        control={control}
        name="preferredDays"
        render={({ field }) => (
          <ChipGroup
            accessibilityLabel="Preferred training days"
            options={WEEKDAYS}
            selected={field.value.map(String) as (typeof WEEKDAYS)[number]['value'][]}
            onToggle={(v) => {
              const n = Number(v);
              field.onChange(
                field.value.includes(n)
                  ? field.value.filter((d) => d !== n)
                  : [...field.value, n].sort(),
              );
            }}
          />
        )}
      />
      <Text variant="small" color="textSecondary">
        Maximum time per session
      </Text>
      <Controller
        control={control}
        name="maxSessionMinutes"
        render={({ field }) => (
          <SegmentedControl
            accessibilityLabel="Maximum session length in minutes"
            options={['20', '30', '45', '60', '90'].map((v) => ({ value: v, label: `${v} min` }))}
            value={String(field.value)}
            onChange={(v) => field.onChange(Number(v))}
          />
        )}
      />
      <Controller
        control={control}
        name="preferredTime"
        render={({ field }) => (
          <SegmentedControl
            accessibilityLabel="Preferred workout time"
            options={[
              { value: 'none', label: 'Any time' },
              { value: '07:00', label: 'Morning' },
              { value: '12:00', label: 'Midday' },
              { value: '18:00', label: 'Evening' },
            ]}
            value={field.value ?? 'none'}
            onChange={(v) => field.onChange(v === 'none' ? null : v)}
          />
        )}
      />

      <Text variant="title" accessibilityRole="header">
        Recurring matches and practices
      </Text>
      {commitments.length === 0 && !editing ? (
        <Text color="textSecondary">
          None added. Add your weekly league match or practice so training avoids those days.
        </Text>
      ) : null}
      {commitments.map((c, i) => (
        <Card key={`${c.title}-${i}`}>
          <Text variant="bodyStrong">{c.title}</Text>
          <Text variant="small" color="textSecondary">
            {WEEKDAYS[c.weekday - 1]?.label} {c.localTime} · {c.durationMinutes} min · {c.intensity}
          </Text>
          <Button
            title="Remove"
            variant="ghost"
            fullWidth={false}
            onPress={() =>
              setValue(
                'commitments',
                commitments.filter((_, j) => j !== i),
              )
            }
          />
        </Card>
      ))}
      {editing ? (
        <Card raised>
          {editError ? <Banner tone="danger" message={editError} /> : null}
          <TextField
            label="Name"
            placeholder="e.g. League match"
            value={editing.title}
            onChangeText={(title) => setEditing({ ...editing, title })}
          />
          <ChipGroup
            accessibilityLabel="Type"
            options={CATEGORY_OPTIONS}
            selected={[editing.category]}
            onToggle={(category) =>
              setEditing({
                ...editing,
                category,
                intensity: category === 'other' ? 'moderate' : 'hard',
              })
            }
          />
          <ChipGroup
            accessibilityLabel="Day of the week"
            options={WEEKDAYS}
            selected={[String(editing.weekday) as (typeof WEEKDAYS)[number]['value']]}
            onToggle={(v) => setEditing({ ...editing, weekday: Number(v) })}
          />
          <View style={{ flexDirection: 'row', gap: spacing.xs }}>
            <View style={{ flex: 1 }}>
              <TextField
                label="Start time (HH:MM)"
                value={editing.localTime}
                onChangeText={(localTime) => setEditing({ ...editing, localTime })}
                keyboardType="numbers-and-punctuation"
                maxLength={5}
              />
            </View>
            <View style={{ flex: 1 }}>
              <NumberField
                label="Duration"
                suffix="min"
                decimal={false}
                precision={0}
                value={editing.durationMinutes}
                onChangeValue={(v) => setEditing({ ...editing, durationMinutes: v ?? 0 })}
              />
            </View>
          </View>
          <Button title="Add to my week" onPress={addCommitment} />
          <Button title="Cancel" variant="ghost" onPress={() => setEditing(null)} />
        </Card>
      ) : commitments.length < 7 ? (
        <Button
          title="Add match or practice"
          variant="secondary"
          onPress={() => setEditing(emptyCommitment())}
        />
      ) : null}
    </OnboardingStep>
  );
}

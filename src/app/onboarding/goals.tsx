import { zodResolver } from '@hookform/resolvers/zod';
import { Redirect, router } from 'expo-router';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { View } from 'react-native';

import { Banner } from '@/components/feedback';
import { ChipGroup, SegmentedControl, Text, Toggle } from '@/components/ui';
import { WEEKLY_RATE } from '@/constants/safety';
import { goalsSchema, type GoalsValues } from '@/domain/validation/onboarding';
import { OnboardingStep } from '@/features/onboarding/components/OnboardingStep';
import { OptionCard } from '@/features/onboarding/components/OptionCard';
import { WeightField } from '@/features/onboarding/components/MeasurementFields';
import { useOnboardingDraft } from '@/features/onboarding/draft-store';
import { spacing } from '@/theme';
import { SportsPicker } from '@/features/sports/SportsPicker';

const GOALS: { value: GoalsValues['goalType']; title: string; description: string }[] = [
  {
    value: 'lose_weight',
    title: 'Lose weight',
    description: 'A moderate deficit while keeping your strength',
  },
  {
    value: 'maintain',
    title: 'Maintain weight',
    description: 'Eat at maintenance and build fitness',
  },
  {
    value: 'build_muscle',
    title: 'Build muscle',
    description: 'A small surplus with strength training',
  },
  {
    value: 'general_fitness',
    title: 'General fitness',
    description: 'Feel better, move more, no weight target',
  },
];

const LOSE_RATES = [0.25, 0.5, 0.75, 1.0] as const;
const BUILD_RATES = [0.1, 0.15, 0.25] as const;

export default function GoalsStep() {
  const personal = useOnboardingDraft((s) => s.personal);
  const saved = useOnboardingDraft((s) => s.goals);
  const save = useOnboardingDraft((s) => s.save);
  const ctx = { weightKg: personal?.weightKg ?? 0, heightCm: personal?.heightCm ?? 0 };
  const { control, handleSubmit, setValue } = useForm<GoalsValues>({
    resolver: zodResolver(goalsSchema(ctx)),
    defaultValues: saved ?? {
      goalType: undefined,
      targetWeightKg: null,
      secondaryTargetWeightKg: null,
      weeklyRatePct: null,
      rateWarningAccepted: false,
      targetDate: null,
      focusTags: [],
      sports: [],
    },
  });

  const goalType = useWatch({ control, name: 'goalType' });
  const rate = useWatch({ control, name: 'weeklyRatePct' });

  if (!personal) return <Redirect href="/onboarding/personal" />;
  const unit = personal.unitSystem;
  const weeklyKg = rate !== null ? (rate / 100) * personal.weightKg : null;

  const onContinue = handleSubmit((values) => {
    // The 'sport' focus follows whether the user plays a sport.
    const focus = values.focusTags.filter((t) => t !== 'sport');
    save('goals', { ...values, focusTags: values.sports.length ? [...focus, 'sport'] : focus });
    router.replace('/onboarding/activity');
  });

  return (
    <OnboardingStep
      step="goals"
      title="What's your main goal?"
      onContinue={() => void onContinue()}
    >
      <Controller
        control={control}
        name="goalType"
        render={({ field, fieldState }) => (
          <View style={{ gap: spacing.xs }} accessibilityRole="radiogroup">
            {GOALS.map((g) => (
              <OptionCard
                key={g.value}
                title={g.title}
                description={g.description}
                selected={field.value === g.value}
                onPress={() => {
                  field.onChange(g.value);
                  setValue(
                    'weeklyRatePct',
                    g.value === 'lose_weight'
                      ? WEEKLY_RATE.lose.default
                      : g.value === 'build_muscle'
                        ? WEEKLY_RATE.build.default
                        : null,
                  );
                }}
              />
            ))}
            {fieldState.error ? <Text color="danger">{fieldState.error.message}</Text> : null}
          </View>
        )}
      />

      {goalType === 'lose_weight' || goalType === 'build_muscle' ? (
        <>
          <Controller
            control={control}
            name="targetWeightKg"
            render={({ field, fieldState }) => (
              <WeightField
                label="Target weight"
                unitSystem={unit}
                value={field.value}
                onChange={field.onChange}
                error={fieldState.error?.message}
              />
            )}
          />
          {goalType === 'lose_weight' ? (
            <Controller
              control={control}
              name="secondaryTargetWeightKg"
              render={({ field, fieldState }) => (
                <WeightField
                  label="Secondary target (optional)"
                  hint="A further milestone after your main target"
                  unitSystem={unit}
                  value={field.value}
                  onChange={field.onChange}
                  error={fieldState.error?.message}
                />
              )}
            />
          ) : null}
          <Text variant="small" color="textSecondary">
            Weekly rate (% of body weight)
          </Text>
          <Controller
            control={control}
            name="weeklyRatePct"
            render={({ field, fieldState }) => (
              <>
                <SegmentedControl
                  accessibilityLabel="Weekly rate"
                  options={(goalType === 'lose_weight' ? LOSE_RATES : BUILD_RATES).map((r) => ({
                    value: String(r),
                    label: `${r}%`,
                  }))}
                  value={field.value === null ? null : String(field.value)}
                  onChange={(v) => field.onChange(Number(v))}
                />
                {weeklyKg !== null ? (
                  <Text variant="caption" color="textSecondary">
                    About {weeklyKg.toFixed(2)} kg per week. Weight changes are not linear week to
                    week.
                  </Text>
                ) : null}
                {fieldState.error ? <Text color="danger">{fieldState.error.message}</Text> : null}
              </>
            )}
          />
          {goalType === 'lose_weight' && rate !== null && rate > WEEKLY_RATE.lose.warnAbove ? (
            <>
              <Banner
                tone="warning"
                title="Faster than recommended"
                message="Losing more than 0.75% per week makes it harder to keep muscle and energy for training. PACE will also cap your daily deficit at a safe level."
              />
              <Controller
                control={control}
                name="rateWarningAccepted"
                render={({ field, fieldState }) => (
                  <Toggle
                    label="I understand and want this rate"
                    value={field.value}
                    onChange={field.onChange}
                    error={fieldState.error?.message}
                  />
                )}
              />
            </>
          ) : null}
        </>
      ) : null}

      <Text variant="title" accessibilityRole="header">
        Your sports
      </Text>
      <Controller
        control={control}
        name="sports"
        render={({ field }) => <SportsPicker value={field.value} onChange={field.onChange} />}
      />
      <Text variant="small" color="textSecondary">
        Also focus on (optional)
      </Text>
      <Controller
        control={control}
        name="focusTags"
        render={({ field }) => (
          <ChipGroup
            options={[
              { value: 'strength', label: 'Strength' },
              { value: 'running', label: 'Running' },
              { value: 'cardio', label: 'Cardio fitness' },
              { value: 'mobility', label: 'Mobility' },
            ]}
            selected={field.value}
            onToggle={(v) =>
              field.onChange(
                field.value.includes(v) ? field.value.filter((x) => x !== v) : [...field.value, v],
              )
            }
          />
        )}
      />
    </OnboardingStep>
  );
}

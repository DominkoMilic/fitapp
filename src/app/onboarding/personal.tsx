import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { Controller, useForm, useWatch } from 'react-hook-form';

import { ControlledTextField } from '@/components/forms/ControlledTextField';
import { SegmentedControl, Text } from '@/components/ui';
import {
  activitySchema,
  type ActivityValues,
  personalSchema,
  type PersonalValues,
} from '@/domain/validation/onboarding';
import { ActivitySection } from '@/features/onboarding/components/ActivitySection';
import { DateField } from '@/features/onboarding/components/DateField';
import { HeightField, WeightField } from '@/features/onboarding/components/MeasurementFields';
import { OnboardingStep } from '@/features/onboarding/components/OnboardingStep';
import { useOnboardingDraft } from '@/features/onboarding/draft-store';
import { detectTimezone, useAsOf } from '@/features/onboarding/useOnboardingContext';

export default function PersonalStep() {
  const asOf = useAsOf();
  const saved = useOnboardingDraft((s) => s.personal);
  const savedActivity = useOnboardingDraft((s) => s.activity);
  const save = useOnboardingDraft((s) => s.save);
  const { control, handleSubmit } = useForm<PersonalValues>({
    resolver: zodResolver(personalSchema(asOf)),
    defaultValues: saved ?? {
      displayName: '',
      dateOfBirth: '',
      calcSex: undefined,
      heightCm: undefined,
      weightKg: undefined,
      unitSystem: 'metric',
      timezone: detectTimezone(),
    },
  });
  const activity = useForm<ActivityValues>({
    resolver: zodResolver(activitySchema),
    defaultValues: savedActivity ?? { activityLevel: undefined, averageDailySteps: null },
  });
  const unitSystem = useWatch({ control, name: 'unitSystem' });

  // Validate both parts so every error shows at once, then save each to its own draft key.
  const onContinue = async () => {
    let personal: PersonalValues | null = null;
    let level: ActivityValues | null = null;
    await handleSubmit((v) => {
      personal = v;
    })();
    await activity.handleSubmit((v) => {
      level = v;
    })();
    if (!personal || !level) return;
    save('personal', personal);
    save('activity', level);
    router.replace('/onboarding/goals');
  };

  return (
    <OnboardingStep
      step="personal"
      title="About you"
      subtitle="Used to estimate your energy needs. You can change everything later."
      onContinue={() => void onContinue()}
    >
      <ControlledTextField
        control={control}
        name="displayName"
        label="Name"
        autoComplete="given-name"
      />
      <Controller
        control={control}
        name="dateOfBirth"
        render={({ field, fieldState }) => (
          <DateField
            label="Date of birth"
            value={field.value || null}
            onChange={(v) => field.onChange(v ?? '')}
            error={fieldState.error?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="calcSex"
        render={({ field, fieldState }) => (
          <>
            <Text variant="small" color="textSecondary">
              Sex used for metabolic calculations
            </Text>
            <SegmentedControl
              accessibilityLabel="Sex used for metabolic calculations"
              options={[
                { value: 'male', label: 'Male' },
                { value: 'female', label: 'Female' },
              ]}
              value={field.value ?? null}
              onChange={field.onChange}
            />
            <Text variant="caption" color="textSecondary">
              Selects the Mifflin-St Jeor equation that best fits your body. Choose the one your
              doctor would use.
            </Text>
            {fieldState.error ? (
              <Text variant="small" color="danger">
                {fieldState.error.message}
              </Text>
            ) : null}
          </>
        )}
      />
      <Controller
        control={control}
        name="unitSystem"
        render={({ field }) => (
          <SegmentedControl
            accessibilityLabel="Units"
            options={[
              { value: 'metric', label: 'kg · cm · km' },
              { value: 'imperial', label: 'lb · ft · mi' },
            ]}
            value={field.value}
            onChange={field.onChange}
          />
        )}
      />
      <Controller
        control={control}
        name="heightCm"
        render={({ field, fieldState }) => (
          <HeightField
            key={unitSystem}
            unitSystem={unitSystem}
            value={field.value ?? null}
            onChange={(v) => field.onChange(v ?? undefined)}
            error={fieldState.error?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="weightKg"
        render={({ field, fieldState }) => (
          <WeightField
            label="Current weight"
            unitSystem={unitSystem}
            value={field.value ?? null}
            onChange={(v) => field.onChange(v ?? undefined)}
            error={fieldState.error?.message}
            hint="Ideally a morning weigh-in"
          />
        )}
      />
      <ActivitySection control={activity.control} />
    </OnboardingStep>
  );
}

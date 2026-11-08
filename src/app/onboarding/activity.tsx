import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { View } from 'react-native';

import { NumberField, Text } from '@/components/ui';
import {
  ACTIVITY_DESCRIPTIONS,
  ACTIVITY_MULTIPLIERS,
  type ActivityLevel,
} from '@/domain/calculations/energy';
import { activitySchema, type ActivityValues } from '@/domain/validation/onboarding';
import { OnboardingStep } from '@/features/onboarding/components/OnboardingStep';
import { OptionCard } from '@/features/onboarding/components/OptionCard';
import { useOnboardingDraft } from '@/features/onboarding/draft-store';
import { spacing } from '@/theme';

const LEVELS = Object.keys(ACTIVITY_MULTIPLIERS) as ActivityLevel[];

export default function ActivityStep() {
  const saved = useOnboardingDraft((s) => s.activity);
  const save = useOnboardingDraft((s) => s.save);
  const { control, handleSubmit } = useForm<ActivityValues>({
    resolver: zodResolver(activitySchema),
    defaultValues: saved ?? { activityLevel: undefined, averageDailySteps: null },
  });

  const onContinue = handleSubmit((values) => {
    save('activity', values);
    router.replace('/onboarding/equipment');
  });

  return (
    <OnboardingStep
      step="activity"
      title="How active are you?"
      subtitle="Include your usual exercise and sport. PACE does not add exercise calories on top, so pick what describes a normal week."
      onContinue={() => void onContinue()}
    >
      <Controller
        control={control}
        name="activityLevel"
        render={({ field, fieldState }) => (
          <View style={{ gap: spacing.xs }} accessibilityRole="radiogroup">
            {LEVELS.map((level) => (
              <OptionCard
                key={level}
                title={`${ACTIVITY_DESCRIPTIONS[level].title} · ×${ACTIVITY_MULTIPLIERS[level]}`}
                description={ACTIVITY_DESCRIPTIONS[level].description}
                selected={field.value === level}
                onPress={() => field.onChange(level)}
              />
            ))}
            {fieldState.error ? <Text color="danger">{fieldState.error.message}</Text> : null}
          </View>
        )}
      />
      <Controller
        control={control}
        name="averageDailySteps"
        render={({ field, fieldState }) => (
          <NumberField
            label="Average daily steps (optional)"
            decimal={false}
            precision={0}
            value={field.value}
            onChangeValue={field.onChange}
            error={fieldState.error ? 'Enter a number between 0 and 60,000' : undefined}
          />
        )}
      />
    </OnboardingStep>
  );
}

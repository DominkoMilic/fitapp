import { type Control, Controller } from 'react-hook-form';
import { View } from 'react-native';

import { NumberField, Text } from '@/components/ui';
import {
  ACTIVITY_DESCRIPTIONS,
  ACTIVITY_MULTIPLIERS,
  type ActivityLevel,
} from '@/domain/calculations/energy';
import type { ActivityValues } from '@/domain/validation/onboarding';
import { spacing } from '@/theme';

import { OptionCard } from './OptionCard';

const LEVELS = Object.keys(ACTIVITY_MULTIPLIERS) as ActivityLevel[];

/** Activity level question, shown inside the "About you" step. */
export function ActivitySection({ control }: { control: Control<ActivityValues> }) {
  return (
    <>
      <Text variant="title" accessibilityRole="header">
        How active are you?
      </Text>
      <Text variant="small" color="textSecondary">
        Include your usual exercise and sport. PACE does not add exercise calories on top, so pick
        what describes a normal week.
      </Text>
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
    </>
  );
}

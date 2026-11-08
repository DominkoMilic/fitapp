import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';

import { SegmentedControl, Text } from '@/components/ui';
import { nutritionSchema, type NutritionValues } from '@/domain/validation/onboarding';
import { ChipInput } from '@/features/onboarding/components/ChipInput';
import { OnboardingStep } from '@/features/onboarding/components/OnboardingStep';
import { DEFAULT_NUTRITION } from '@/features/onboarding/constants';
import { useOnboardingDraft } from '@/features/onboarding/draft-store';

const ALLERGEN_SUGGESTIONS = [
  'peanut',
  'tree nuts',
  'milk',
  'egg',
  'fish',
  'shellfish',
  'soy',
  'wheat/gluten',
  'sesame',
];

export default function NutritionStep() {
  const saved = useOnboardingDraft((s) => s.nutrition);
  const save = useOnboardingDraft((s) => s.save);
  const { control, handleSubmit } = useForm<NutritionValues>({
    resolver: zodResolver(nutritionSchema),
    defaultValues: saved ?? DEFAULT_NUTRITION,
  });

  const onContinue = handleSubmit((values) => {
    save('nutrition', values);
    router.replace('/onboarding/health');
  });

  return (
    <OnboardingStep
      step="nutrition"
      title="How do you eat?"
      subtitle="Used to filter recipes and suggestions. Nothing here changes your calorie target."
      onContinue={() => void onContinue()}
      onSkip={() => {
        save('nutrition', saved ?? DEFAULT_NUTRITION);
        router.replace('/onboarding/health');
      }}
    >
      <Controller
        control={control}
        name="dietType"
        render={({ field }) => (
          <SegmentedControl
            accessibilityLabel="Diet"
            options={[
              { value: 'omnivore', label: 'Omnivore' },
              { value: 'vegetarian', label: 'Vegetarian' },
              { value: 'vegan', label: 'Vegan' },
              { value: 'pescatarian', label: 'Pescatarian' },
            ]}
            value={field.value === 'other' ? null : field.value}
            onChange={field.onChange}
          />
        )}
      />
      <Controller
        control={control}
        name="allergies"
        render={({ field }) => (
          <ChipInput
            label="Allergies"
            values={field.value}
            onChange={field.onChange}
            suggestions={ALLERGEN_SUGGESTIONS}
          />
        )}
      />
      <Controller
        control={control}
        name="intolerances"
        render={({ field }) => (
          <ChipInput label="Intolerances" values={field.value} onChange={field.onChange} />
        )}
      />
      <Controller
        control={control}
        name="dislikedFoods"
        render={({ field }) => (
          <ChipInput label="Foods you dislike" values={field.value} onChange={field.onChange} />
        )}
      />
      <Controller
        control={control}
        name="preferredCuisines"
        render={({ field }) => (
          <ChipInput
            label="Cuisines you like"
            values={field.value}
            onChange={field.onChange}
            suggestions={['croatian', 'italian', 'mediterranean', 'mexican', 'asian']}
          />
        )}
      />
      <Text variant="small" color="textSecondary">
        Meals per day (plus snacks)
      </Text>
      <Controller
        control={control}
        name="mealsPerDay"
        render={({ field }) => (
          <SegmentedControl
            accessibilityLabel="Meals per day"
            options={['2', '3', '4', '5', '6'].map((v) => ({ value: v, label: v }))}
            value={String(field.value)}
            onChange={(v) => field.onChange(Number(v))}
          />
        )}
      />
      <Text variant="small" color="textSecondary">
        Cooking time
      </Text>
      <Controller
        control={control}
        name="cookingTimeMaxMinutes"
        render={({ field }) => (
          <SegmentedControl
            accessibilityLabel="Maximum cooking time"
            options={[
              { value: '15', label: '≤15 min' },
              { value: '30', label: '≤30 min' },
              { value: '60', label: '≤60 min' },
              { value: 'any', label: 'Any' },
            ]}
            value={field.value === null ? 'any' : String(field.value)}
            onChange={(v) => field.onChange(v === 'any' ? null : Number(v))}
          />
        )}
      />
      <Text variant="small" color="textSecondary">
        Cooking for
      </Text>
      <Controller
        control={control}
        name="householdServings"
        render={({ field }) => (
          <SegmentedControl
            accessibilityLabel="People you usually cook for"
            options={['1', '2', '3', '4'].map((v) => ({
              value: v,
              label: v === '1' ? '1 person' : `${v}`,
            }))}
            value={String(Math.min(field.value, 4))}
            onChange={(v) => field.onChange(Number(v))}
          />
        )}
      />
    </OnboardingStep>
  );
}

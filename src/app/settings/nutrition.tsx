import { useState } from 'react';

import { ErrorState, LoadingState } from '@/components/feedback';
import { Button, Screen, SegmentedControl, Text } from '@/components/ui';
import { ChipInput } from '@/features/onboarding/components/ChipInput';
import { type Preferences, usePreferences, useUpdatePreferences } from '@/features/profile/api';
import { SaveState } from '@/features/profile/SaveState';

type Diet = 'omnivore' | 'vegetarian' | 'vegan' | 'pescatarian' | 'other';

export default function NutritionSettings() {
  const prefs = usePreferences();
  if (prefs.isPending)
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  if (prefs.isError)
    return (
      <Screen>
        <ErrorState
          message="We couldn't load your preferences."
          onRetry={() => void prefs.refetch()}
        />
      </Screen>
    );
  return <NutritionForm prefs={prefs.data} />;
}

function NutritionForm({ prefs }: { prefs: Preferences | null }) {
  const update = useUpdatePreferences();
  const [v, setV] = useState({
    diet: (prefs?.diet_type ?? 'omnivore') as Diet,
    allergies: prefs?.allergies ?? [],
    intolerances: prefs?.intolerances ?? [],
    disliked: prefs?.disliked_foods ?? [],
    cuisines: prefs?.preferred_cuisines ?? [],
    meals: prefs?.meals_per_day ?? 3,
    household: prefs?.household_servings ?? 1,
  });
  return (
    <Screen
      edges={['bottom']}
      footer={
        <Button
          title="Save"
          loading={update.isPending}
          onPress={() =>
            update.mutate({
              diet_type: v.diet,
              allergies: v.allergies,
              intolerances: v.intolerances,
              disliked_foods: v.disliked,
              preferred_cuisines: v.cuisines,
              meals_per_day: v.meals,
              household_servings: v.household,
            })
          }
        />
      }
    >
      <SaveState status={update.status} error={update.error} />
      <SegmentedControl<Diet>
        accessibilityLabel="Diet"
        options={[
          { value: 'omnivore', label: 'Omnivore' },
          { value: 'vegetarian', label: 'Vegetarian' },
          { value: 'vegan', label: 'Vegan' },
          { value: 'pescatarian', label: 'Pescatarian' },
        ]}
        value={v.diet === 'other' ? null : v.diet}
        onChange={(diet) => setV({ ...v, diet })}
      />
      <ChipInput
        label="Allergies"
        values={v.allergies}
        onChange={(allergies) => setV({ ...v, allergies })}
      />
      <ChipInput
        label="Intolerances"
        values={v.intolerances}
        onChange={(intolerances) => setV({ ...v, intolerances })}
      />
      <ChipInput
        label="Foods you dislike"
        values={v.disliked}
        onChange={(disliked) => setV({ ...v, disliked })}
      />
      <ChipInput
        label="Cuisines you like"
        values={v.cuisines}
        onChange={(cuisines) => setV({ ...v, cuisines })}
      />
      <Text variant="small" color="textSecondary">
        Meals per day
      </Text>
      <SegmentedControl
        accessibilityLabel="Meals per day"
        options={['2', '3', '4', '5', '6'].map((x) => ({ value: x, label: x }))}
        value={String(v.meals)}
        onChange={(x) => setV({ ...v, meals: Number(x) })}
      />
      <Text variant="small" color="textSecondary">
        Cooking for
      </Text>
      <SegmentedControl
        accessibilityLabel="People you usually cook for"
        options={['1', '2', '3', '4'].map((x) => ({ value: x, label: x }))}
        value={String(Math.min(v.household, 4))}
        onChange={(x) => setV({ ...v, household: Number(x) })}
      />
    </Screen>
  );
}

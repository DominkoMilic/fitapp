import { ErrorState, LoadingState } from '@/components/feedback';
import { Card, Screen, Text, Toggle } from '@/components/ui';
import { usePreferences } from '@/features/profile/api';
import { useSetNutritionEnabled } from '@/features/profile/features';
import { SaveState } from '@/features/profile/SaveState';

/** Turn optional parts of PACE on or off (spec 6.5). */
export default function AppFeatures() {
  const prefs = usePreferences();
  const set = useSetNutritionEnabled();
  if (prefs.isPending)
    return (
      <Screen edges={['bottom']}>
        <LoadingState />
      </Screen>
    );
  if (prefs.isError || !prefs.data)
    return (
      <Screen edges={['bottom']}>
        <ErrorState
          message="Your settings couldn't be loaded."
          onRetry={() => void prefs.refetch()}
        />
      </Screen>
    );
  const on = set.isPending
    ? (set.variables ?? prefs.data.nutrition_enabled)
    : prefs.data.nutrition_enabled;
  return (
    <Screen edges={['bottom']}>
      <Toggle
        label="Nutrition tracking"
        description="Food logging, calorie and macro targets, water, recipes, meal planning and their reminders."
        value={on}
        onChange={(v) => set.mutate(v)}
      />
      <SaveState status={set.status} error={set.error} />
      <Card>
        <Text variant="small" color="textSecondary">
          {on
            ? 'Turn this off if you only want to use PACE for training and weight. The Nutrition tab, calorie targets, food and water reminders and the two-week target review disappear.'
            : 'Nutrition is off. Your food history, recipes and targets are kept, so everything is back exactly as it was when you turn it on again. Weight tracking and your goal still work.'}
        </Text>
      </Card>
    </Screen>
  );
}

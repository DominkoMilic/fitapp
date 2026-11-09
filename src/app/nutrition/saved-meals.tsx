import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import {
  ConfirmDialog,
  EmptyState,
  ErrorState,
  LoadingState,
  useToast,
} from '@/components/feedback';
import { Button, Card, Screen, Text } from '@/components/ui';
import { sumNutrition, mealTypeForTime } from '@/domain/nutrition/totals';
import { useToday } from '@/features/dashboard/useToday';
import {
  type SavedMeal,
  savedMealItems,
  useNutritionActions,
  useSavedMeals,
} from '@/features/nutrition/api';
import { MealPicker } from '@/features/nutrition/MealPicker';
import { asDate, asMeal } from '@/features/nutrition/params';

export default function SavedMeals() {
  const params = useLocalSearchParams<{ date?: string }>();
  const { today, hour } = useToday();
  const date = asDate(params.date, today);
  const saved = useSavedMeals();
  const actions = useNutritionActions();
  const showToast = useToast((s) => s.show);
  const [meal, setMeal] = useState(mealTypeForTime(hour * 60));
  const [toArchive, setToArchive] = useState<SavedMeal | null>(null);

  if (saved.isPending)
    return (
      <Screen edges={['bottom']}>
        <LoadingState />
      </Screen>
    );
  if (saved.isError && !saved.rows.length)
    return (
      <Screen edges={['bottom']}>
        <ErrorState
          message="Your saved meals couldn't be loaded. Check your connection."
          onRetry={() => void saved.refetch()}
        />
      </Screen>
    );
  if (!saved.rows.length) {
    return (
      <Screen edges={['bottom']}>
        <EmptyState
          title="No saved meals yet"
          message="On the Nutrition tab, use “Save as a meal” under any meal you log often."
        />
      </Screen>
    );
  }
  return (
    <Screen edges={['bottom']}>
      <Text variant="small" color="textSecondary">
        Log into
      </Text>
      <MealPicker value={meal} onChange={setMeal} />
      {saved.rows.map((m) => {
        const items = savedMealItems(m);
        const t = sumNutrition(items);
        return (
          <Card key={m.id}>
            <Text variant="bodyStrong">{m.name}</Text>
            <Text variant="small" color="textSecondary">
              {items.length} item{items.length === 1 ? '' : 's'} · {Math.round(t.kcal)} kcal · P{' '}
              {Math.round(t.protein_g)} g
            </Text>
            <Text variant="caption" color="textSecondary">
              {items.map((i) => i.name).join(', ')}
            </Text>
            <Button
              title="Log it"
              onPress={() =>
                void (async () => {
                  for (const i of items) {
                    await actions.logItem({
                      date,
                      meal: asMeal(meal),
                      name: i.name,
                      foodId: i.food_id,
                      quantity: i.quantity,
                      unit: i.unit,
                      grams: i.grams,
                      nutrition: {
                        kcal: i.kcal,
                        protein_g: i.protein_g,
                        carbs_g: i.carbs_g,
                        fat_g: i.fat_g,
                        fibre_g: i.fibre_g,
                      },
                      source: 'saved_meal',
                      confidence: 'user',
                    });
                  }
                  showToast(`${m.name} logged`);
                })()
              }
            />
            <Button
              title="Remove"
              variant="ghost"
              fullWidth={false}
              onPress={() => setToArchive(m)}
            />
          </Card>
        );
      })}
      <ConfirmDialog
        visible={toArchive !== null}
        title="Remove this saved meal?"
        message="Meals you already logged stay in your history."
        confirmLabel="Remove"
        destructive
        onCancel={() => setToArchive(null)}
        onConfirm={async () => {
          if (toArchive) await actions.archiveSavedMeal(toArchive);
          setToArchive(null);
        }}
      />
    </Screen>
  );
}

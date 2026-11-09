import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  ConfirmDialog,
  EmptyState,
  ErrorState,
  LoadingState,
  useToast,
} from '@/components/feedback';
import { AnimatedRow, Button, Card, ChipGroup, Screen, Text } from '@/components/ui';
import { formatShortDate, plural } from '@/domain/format';
import { sumNutrition, mealTypeForTime } from '@/domain/nutrition/totals';
import { useToday } from '@/features/dashboard/useToday';
import {
  type SavedMeal,
  type SavedMealItem,
  savedMealItems,
  useNutritionActions,
  useSavedMeals,
} from '@/features/nutrition/api';
import { MealPicker } from '@/features/nutrition/MealPicker';
import { asDate, asMeal } from '@/features/nutrition/params';
import { useSubmit } from '@/hooks/useSubmit';

export default function SavedMeals() {
  const params = useLocalSearchParams<{ date?: string }>();
  const { today, hour } = useToday();
  const date = asDate(params.date, today);
  const saved = useSavedMeals();
  const actions = useNutritionActions();
  const showToast = useToast((s) => s.show);
  const [meal, setMeal] = useState(mealTypeForTime(hour * 60));
  const [toArchive, setToArchive] = useState<SavedMeal | null>(null);
  const [logging, setLogging] = useState<string | null>(null);
  const newMeal = (
    <Button
      title="Create a meal"
      variant="secondary"
      onPress={() => router.push('/nutrition/meal-edit')}
    />
  );

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
          message="Build a meal you eat often from foods, your recipes and quick items, or use “Save as a meal” under a meal on the Nutrition tab."
          actionLabel="Create a meal"
          onAction={() => router.push('/nutrition/meal-edit')}
        />
      </Screen>
    );
  }
  return (
    <Screen edges={['bottom']} footer={newMeal}>
      <Text variant="small" color="textSecondary">
        Log into ({date === today ? 'today' : formatShortDate(date)})
      </Text>
      <MealPicker value={meal} onChange={setMeal} />
      {saved.rows.map((m) => {
        const items = savedMealItems(m);
        const t = sumNutrition(items);
        return (
          <AnimatedRow key={m.id}>
            <Card>
              <Text variant="bodyStrong">{m.name}</Text>
              <Text variant="small" color="textSecondary">
                {plural(items.length, 'item')} · {Math.round(t.kcal)} kcal · P{' '}
                {Math.round(t.protein_g)} g
              </Text>
              {logging === m.id ? (
                <PartialLog
                  items={items}
                  onCancel={() => setLogging(null)}
                  onLog={async (chosen) => {
                    for (const i of chosen) {
                      await actions.logItem({
                        date,
                        meal: asMeal(meal),
                        name: i.name,
                        foodId: i.food_id,
                        recipeId: i.recipe_id,
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
                        confidence: i.confidence,
                      });
                    }
                    setLogging(null);
                    showToast(
                      chosen.length === items.length
                        ? `${m.name} logged`
                        : `${plural(chosen.length, 'item')} from ${m.name} logged`,
                    );
                  }}
                />
              ) : (
                <>
                  <Text variant="caption" color="textSecondary">
                    {items.map((i) => i.name).join(', ')}
                  </Text>
                  <Button title="Log it" onPress={() => setLogging(m.id)} />
                  <View style={styles.actions}>
                    <Button
                      title="Edit"
                      variant="ghost"
                      fullWidth={false}
                      accessibilityLabel={`Edit ${m.name}`}
                      onPress={() =>
                        router.push({ pathname: '/nutrition/meal-edit', params: { id: m.id } })
                      }
                    />
                    <Button
                      title="Duplicate"
                      variant="ghost"
                      fullWidth={false}
                      accessibilityLabel={`Duplicate ${m.name}`}
                      onPress={() =>
                        router.push({ pathname: '/nutrition/meal-edit', params: { from: m.id } })
                      }
                    />
                    <Button
                      title="Remove"
                      variant="ghost"
                      fullWidth={false}
                      accessibilityLabel={`Remove ${m.name}`}
                      onPress={() => setToArchive(m)}
                    />
                  </View>
                </>
              )}
            </Card>
          </AnimatedRow>
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

/** Tick the items you actually ate; everything is ticked to start with. */
function PartialLog({
  items,
  onLog,
  onCancel,
}: {
  items: SavedMealItem[];
  onLog: (chosen: SavedMealItem[]) => Promise<void>;
  onCancel: () => void;
}) {
  const [picked, setPicked] = useState<string[]>(items.map((_, k) => String(k)));
  const chosen = items.filter((_, k) => picked.includes(String(k)));
  const t = sumNutrition(chosen);
  const submit = useSubmit(() => onLog(chosen));
  return (
    <>
      <Text variant="small" color="textSecondary">
        What did you have?
      </Text>
      <ChipGroup
        accessibilityLabel="Items to log"
        options={items.map((i, k) => ({ value: String(k), label: i.name }))}
        selected={picked}
        onToggle={(v) =>
          setPicked(picked.includes(v) ? picked.filter((x) => x !== v) : [...picked, v])
        }
      />
      <Button
        title={
          chosen.length === items.length
            ? `Log all · ${Math.round(t.kcal)} kcal`
            : `Log ${plural(chosen.length, 'item')} · ${Math.round(t.kcal)} kcal`
        }
        disabled={!chosen.length}
        loading={submit.busy}
        onPress={() => void submit.run()}
      />
      <Button title="Cancel" variant="ghost" onPress={onCancel} />
    </>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', flexWrap: 'wrap' },
});

import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Banner, LoadingState, useToast } from '@/components/feedback';
import {
  Button,
  Card,
  ChipGroup,
  ListItem,
  NumberField,
  Screen,
  SectionHeader,
  Text,
  TextField,
} from '@/components/ui';
import { addDays } from '@/domain/calculations/dates';
import { readIngredients } from '@/domain/nutrition/recipe-ingredients';
import { rankSuggestions, type SuggestionCandidate } from '@/domain/nutrition/suggestions';
import {
  MEAL_LABELS,
  MEAL_TYPES,
  type MealType,
  slotShare,
  sumNutrition,
} from '@/domain/nutrition/totals';
import { weekStartOf } from '@/domain/training/records';
import { targetFor } from '@/features/dashboard/today';
import { useToday } from '@/features/dashboard/useToday';
import { savedMealItems, useNutritionActions, useSavedMeals } from '@/features/nutrition/api';
import {
  type PlanEntry,
  usePlanEntries,
  usePlannerActions,
  weekDates,
} from '@/features/nutrition/planner-api';
import {
  type RecipeRow,
  useMyRecipes,
  useRecipesByIds,
  useSavedRecipes,
} from '@/features/nutrition/recipes-api';
import { useRecipeFlagger } from '@/features/nutrition/usePreferencesFlags';
import { usePreferences, useProfile, useTargetHistory } from '@/features/profile/api';
import { dayLabel } from '@/features/training/labels';
import { spacing } from '@/theme';
import { useGuardedAction } from '@/hooks/useSubmit';
import { LoadErrorBanner } from '@/components/feedback/LoadErrorBanner';

export default function Planner() {
  const { today } = useToday();
  const { data: profile } = useProfile();
  const { data: prefs } = usePreferences();
  const targets = useTargetHistory();
  const [offset, setOffset] = useState(0);
  const start = addDays(weekStartOf(today, profile?.week_start === 7 ? 7 : 1), offset * 7);
  const days = weekDates(start);
  const [day, setDay] = useState(today >= start && today <= days[6]! ? today : start);
  const plan = usePlanEntries(start, days[6]!);
  const myRecipes = useMyRecipes();
  const saved = useSavedRecipes();
  const savedRecipes = useRecipesByIds(saved.rows.map((s) => s.recipe_id));
  const savedMeals = useSavedMeals();
  const flag = useRecipeFlagger();
  const actions = usePlannerActions();
  const log = useNutritionActions();
  const showToast = useToast((s) => s.show);
  const guard = useGuardedAction();
  const [adding, setAdding] = useState<MealType | null>(null);
  const [skip, setSkip] = useState<Set<string>>(new Set());

  const recipes = useMemo(() => {
    const m = new Map<string, RecipeRow>();
    for (const r of [...myRecipes.rows, ...(savedRecipes.data ?? [])]) m.set(r.id, r);
    return m;
  }, [myRecipes.rows, savedRecipes.data]);
  const target = targetFor(targets.data ?? [], day);

  const entryKcal = (e: PlanEntry): number | null => {
    if (e.recipe_id) {
      const r = recipes.get(e.recipe_id);
      return r?.kcal_per_serving == null ? null : Number(r.kcal_per_serving) * Number(e.servings);
    }
    if (e.saved_meal_id) {
      const m = savedMeals.rows.find((x) => x.id === e.saved_meal_id);
      return m ? sumNutrition(savedMealItems(m)).kcal * Number(e.servings) : null;
    }
    return null;
  };
  const dayEntries = plan.rows.filter((e) => e.local_date === day);
  const known = dayEntries.map(entryKcal);
  const plannedKcal = known.reduce<number>((a, v) => a + (v ?? 0), 0);
  const partial = known.some((v) => v === null);

  const candidates: SuggestionCandidate[] = [
    ...[...recipes.values()].map((r) => ({
      id: r.id,
      kind: 'recipe' as const,
      name: r.name,
      kcalPerServing: r.kcal_per_serving == null ? null : Number(r.kcal_per_serving),
      proteinPerServing: r.protein_per_serving == null ? null : Number(r.protein_per_serving),
      totalMinutes: (r.preparation_minutes ?? 0) + (r.cooking_minutes ?? 0) || null,
      excluded: flag(readIngredients(r.ingredients).map((i) => i.name)).exclude,
    })),
    ...savedMeals.rows.map((m) => {
      const t = sumNutrition(savedMealItems(m));
      return {
        id: m.id,
        kind: 'saved_meal' as const,
        name: m.name,
        kcalPerServing: t.kcal,
        proteinPerServing: t.protein_g,
        totalMinutes: null,
        excluded: false,
      };
    }),
  ];

  const markEaten = async (e: PlanEntry) => {
    const r = e.recipe_id ? recipes.get(e.recipe_id) : undefined;
    const m = e.saved_meal_id ? savedMeals.rows.find((x) => x.id === e.saved_meal_id) : undefined;
    const meal = e.meal_type as MealType;
    const s = Number(e.servings);
    if (r && r.kcal_per_serving != null) {
      const n = (v: number | null) => (v === null ? null : Number(v) * s);
      await log.logItem({
        date: e.local_date,
        meal,
        name: r.name,
        foodId: null,
        recipeId: r.id,
        quantity: s,
        unit: s === 1 ? 'serving' : 'servings',
        grams: null,
        nutrition: {
          kcal: n(r.kcal_per_serving),
          protein_g: n(r.protein_per_serving),
          carbs_g: n(r.carbs_per_serving),
          fat_g: n(r.fat_per_serving),
          fibre_g: n(r.fibre_per_serving),
        },
        source: 'meal_plan',
        confidence: 'calculated',
      });
    } else if (m) {
      for (const i of savedMealItems(m)) {
        const n = (v: number | null) => (v === null ? null : v * s);
        await log.logItem({
          date: e.local_date,
          meal,
          name: i.name,
          foodId: i.food_id,
          quantity: i.quantity === null ? null : i.quantity * s,
          unit: i.unit,
          grams: n(i.grams),
          nutrition: {
            kcal: n(i.kcal),
            protein_g: n(i.protein_g),
            carbs_g: n(i.carbs_g),
            fat_g: n(i.fat_g),
            fibre_g: n(i.fibre_g),
          },
          source: 'meal_plan',
          confidence: 'user',
        });
      }
    } else {
      // No reliable nutrition (TheMealDB recipe or free text): let the user enter an estimate.
      await actions.setStatus(e, 'eaten');
      router.push({ pathname: '/nutrition/quick-add', params: { date: e.local_date, meal } });
      return;
    }
    await actions.setStatus(e, 'eaten');
    showToast('Logged from your plan. You can edit it on the Nutrition tab.');
  };

  return (
    <Screen
      edges={['bottom']}
      footer={
        <Button
          title="Shopping list"
          variant="secondary"
          onPress={() =>
            router.push({ pathname: '/nutrition/shopping', params: { from: start, to: days[6] } })
          }
        />
      }
    >
      <LoadErrorBanner
        visible={plan.isError}
        what="your meal plan"
        onRetry={() => void plan.refetch()}
      />
      <View style={styles.row}>
        <Button
          title="‹"
          variant="ghost"
          fullWidth={false}
          accessibilityLabel="Previous week"
          onPress={() => {
            setOffset(offset - 1);
            setDay(addDays(start, -7));
          }}
        />
        <Text variant="bodyStrong">
          {dayLabel(start, '')} – {dayLabel(days[6]!, '')}
        </Text>
        <Button
          title="›"
          variant="ghost"
          fullWidth={false}
          accessibilityLabel="Next week"
          onPress={() => {
            setOffset(offset + 1);
            setDay(addDays(start, 7));
          }}
        />
      </View>
      <ChipGroup
        accessibilityLabel="Day"
        options={days.map((d) => ({ value: d, label: dayLabel(d, today).split(' ')[0] ?? d }))}
        selected={[day]}
        onToggle={setDay}
      />
      <Card>
        <Text variant="small" color="textSecondary">
          {dayLabel(day, today)} · planned
        </Text>
        <Text variant="title" numeric>
          {Math.round(plannedKcal)}
          {target ? ` / ${target.kcal}` : ''} kcal{partial ? ' (partial)' : ''}
        </Text>
        {partial ? (
          <Text variant="caption" color="textSecondary">
            Some planned meals have no nutrition data.
          </Text>
        ) : null}
      </Card>
      {plan.isPending ? <LoadingState /> : null}

      {MEAL_TYPES.map((meal) => {
        const entries = dayEntries.filter((e) => e.meal_type === meal);
        const slotKcal = target ? target.kcal * slotShare(meal, prefs?.meals_per_day ?? 3) : 0;
        const suggestions = rankSuggestions({
          candidates,
          slotKcal,
          remainingProteinG: null,
          maxCookingMinutes: prefs?.cooking_time_max_minutes ?? null,
          skipIds: skip,
        }).slice(0, 3);
        return (
          <View key={meal} style={styles.meal}>
            <SectionHeader
              title={MEAL_LABELS[meal]}
              action={
                <Button
                  title="Add"
                  variant="ghost"
                  fullWidth={false}
                  onPress={() => setAdding(adding === meal ? null : meal)}
                />
              }
            />
            {entries.map((e) => {
              const k = entryKcal(e);
              return (
                <Card key={e.id}>
                  <Text
                    variant="bodyStrong"
                    color={e.status === 'skipped' ? 'textSecondary' : 'textPrimary'}
                  >
                    {e.title_snapshot}
                    {Number(e.servings) !== 1 ? ` × ${Number(e.servings)}` : ''}
                  </Text>
                  <Text variant="small" color="textSecondary">
                    {[
                      k === null ? 'nutrition unknown' : `${Math.round(k)} kcal`,
                      e.status !== 'planned' ? e.status : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                  {e.status === 'planned' ? (
                    <View style={styles.row}>
                      <Button
                        title="Mark eaten"
                        fullWidth={false}
                        onPress={() => guard(markEaten(e))}
                      />
                      <Button
                        title="Skip"
                        variant="ghost"
                        fullWidth={false}
                        onPress={() => guard(actions.setStatus(e, 'skipped'))}
                      />
                      <Button
                        title="Remove"
                        variant="ghost"
                        fullWidth={false}
                        onPress={() => guard(actions.remove(e, plan.serverKeys.has(e.id)))}
                      />
                    </View>
                  ) : null}
                </Card>
              );
            })}
            {adding === meal ? (
              <AddEntry
                suggestions={suggestions}
                recipes={[...recipes.values()]}
                savedMeals={savedMeals.rows.map((m) => ({ id: m.id, name: m.name }))}
                onMore={() => setSkip(new Set([...skip, ...suggestions.map((s) => s.id)]))}
                onAdd={async (p) => {
                  await actions.add({ date: day, meal, ...p });
                  setAdding(null);
                }}
                onCancel={() => setAdding(null)}
              />
            ) : null}
          </View>
        );
      })}
      {!candidates.some((c) => c.kcalPerServing !== null) ? (
        <Banner
          tone="info"
          message="Suggestions use recipes and saved meals with known nutrition. Build a recipe or save a meal to get suggestions."
        />
      ) : null}
    </Screen>
  );
}

function AddEntry(props: {
  suggestions: {
    id: string;
    kind: 'recipe' | 'saved_meal';
    name: string;
    kcalPerServing: number | null;
  }[];
  recipes: RecipeRow[];
  savedMeals: { id: string; name: string }[];
  onMore: () => void;
  onAdd: (p: {
    title: string;
    recipeId?: string;
    savedMealId?: string;
    customTitle?: string;
    servings: number;
  }) => Promise<void>;
  onCancel: () => void;
}) {
  const [servings, setServings] = useState<number | null>(1);
  const [custom, setCustom] = useState('');
  const s = servings && servings > 0 && servings <= 20 ? servings : 1;
  return (
    <Card raised>
      <NumberField label="Servings" value={servings} onChangeValue={setServings} />
      {props.suggestions.length ? (
        <Text variant="small" color="textSecondary">
          Suggested for this meal
        </Text>
      ) : null}
      {props.suggestions.map((x) => (
        <ListItem
          key={x.id}
          title={x.name}
          value={x.kcalPerServing === null ? undefined : `${Math.round(x.kcalPerServing)} kcal`}
          onPress={() =>
            void props.onAdd(
              x.kind === 'recipe'
                ? { title: x.name, recipeId: x.id, servings: s }
                : { title: x.name, savedMealId: x.id, servings: s },
            )
          }
        />
      ))}
      {props.suggestions.length ? (
        <Button
          title="Other suggestions"
          variant="ghost"
          fullWidth={false}
          onPress={props.onMore}
        />
      ) : null}
      {props.recipes.length ? (
        <Text variant="small" color="textSecondary">
          All recipes
        </Text>
      ) : null}
      {props.recipes.map((r) => (
        <ListItem
          key={r.id}
          title={r.name}
          subtitle={r.source === 'user' ? 'My recipe' : 'Saved recipe'}
          onPress={() => void props.onAdd({ title: r.name, recipeId: r.id, servings: s })}
        />
      ))}
      {props.savedMeals.map((m) => (
        <ListItem
          key={m.id}
          title={m.name}
          subtitle="Saved meal"
          onPress={() => void props.onAdd({ title: m.name, savedMealId: m.id, servings: s })}
        />
      ))}
      <TextField
        label="Or type a meal"
        placeholder="e.g. Pizza with friends"
        value={custom}
        onChangeText={setCustom}
        maxLength={120}
      />
      <Button
        title="Add"
        disabled={!custom.trim()}
        onPress={() =>
          void props.onAdd({ title: custom.trim(), customTitle: custom.trim(), servings: s })
        }
      />
      <Button title="Cancel" variant="ghost" onPress={props.onCancel} />
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  meal: { gap: spacing.xs },
});

import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Banner, ErrorState, LoadingState, useToast } from '@/components/feedback';
import {
  AnimatedRow,
  Button,
  Card,
  ListItem,
  NumberField,
  rowKeys,
  Screen,
  SectionHeader,
  SegmentedControl,
  StatTile,
  Text,
  TextField,
} from '@/components/ui';
import { nutritionForGrams } from '@/domain/nutrition/totals';
import {
  itemAmount,
  itemsFromLog,
  type MealDraft,
  type MealItem,
  mealDraftSchema,
  mealTotals,
  readMealItems,
  recipeMealItem,
  scaleMealItem,
} from '@/domain/nutrition/saved-meal-draft';
import { MEAL_LABELS, MEAL_TYPES, type MealType } from '@/domain/nutrition/totals';
import { moveItem } from '@/domain/nutrition/recipe-draft';
import { useDayLog, useNutritionActions, useSavedMeals } from '@/features/nutrition/api';
import { FoodPicker } from '@/features/nutrition/FoodPicker';
import { asMeal } from '@/features/nutrition/params';
import { useMyRecipes } from '@/features/nutrition/recipes-api';
import { RowActions } from '@/features/nutrition/RowActions';
import { useSubmit } from '@/hooks/useSubmit';
import { spacing } from '@/theme';

/**
 * Build or edit one of your meals ("my usual breakfast").
 * ?id= edits it, ?from= starts from a copy, ?date=&meal= starts from what you logged for that meal.
 */
export default function MealEditScreen() {
  const params = useLocalSearchParams<{
    id?: string;
    from?: string;
    date?: string;
    meal?: string;
  }>();
  const saved = useSavedMeals();
  const fromLog = !params.id && !params.from && !!params.date;
  const day = useDayLog(params.date ?? '0000-00-00');

  const sourceId = params.id ?? params.from;
  if (sourceId || fromLog) {
    const pending = sourceId ? saved.isPending : day.isPending;
    const failed = sourceId ? saved.isError && !saved.rows.length : day.isError && !day.rows.length;
    if (pending)
      return (
        <Screen edges={['bottom']}>
          <LoadingState />
        </Screen>
      );
    if (failed)
      return (
        <Screen edges={['bottom']}>
          <ErrorState
            message="This meal couldn't be loaded. Check your connection."
            onRetry={() => void (sourceId ? saved.refetch() : day.refetch())}
          />
        </Screen>
      );
  }
  if (sourceId) {
    const m = saved.rows.find((x) => x.id === sourceId);
    if (!m)
      return (
        <Screen edges={['bottom']}>
          <ErrorState message="This meal no longer exists." />
        </Screen>
      );
    const initial: MealDraft = {
      name: params.id ? m.name : `${m.name} (copy)`.slice(0, 80),
      mealType: (m.meal_type as MealType | null) ?? null,
      items: readMealItems(m.items),
    };
    return params.id ? (
      <Editor
        key={m.id}
        initial={initial}
        existing={{ id: m.id, onServer: saved.serverKeys.has(m.id) }}
      />
    ) : (
      <Editor key={`copy-${m.id}`} initial={initial} />
    );
  }
  if (fromLog) {
    const meal = asMeal(params.meal);
    const items = day.rows.filter((r) => r.meal_type === meal);
    return (
      <Editor
        initial={{ name: '', mealType: meal, items: itemsFromLog(items) }}
        note={`Built from your ${MEAL_LABELS[meal].toLowerCase()}. Check the items, then name it.`}
      />
    );
  }
  return <Editor initial={{ name: '', mealType: null, items: [] }} />;
}

function Editor({
  initial,
  existing,
  note,
}: {
  initial: MealDraft;
  existing?: { id: string; onServer: boolean };
  note?: string;
}) {
  const actions = useNutritionActions();
  const showToast = useToast((s) => s.show);
  const [d, setD] = useState<MealDraft>(initial);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState<'food' | 'quick' | 'recipe' | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const set = (patch: Partial<MealDraft>) => setD((prev) => ({ ...prev, ...patch }));
  const add = (item: MealItem) => {
    set({ items: [...d.items, item] });
    setAdding(null);
  };
  const t = mealTotals(d.items);
  const keys = rowKeys(d.items, (i) => i.name);

  const submit = useSubmit(async () => {
    const parsed = mealDraftSchema.safeParse(d);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check the meal.');
      return;
    }
    setError(null);
    await actions.saveSavedMeal(d, existing);
    showToast(existing ? 'Meal updated' : 'Meal saved');
    router.replace('/nutrition/saved-meals');
  });

  return (
    <Screen
      edges={['bottom']}
      footer={
        <Button
          title={existing ? 'Save changes' : 'Save meal'}
          loading={submit.busy}
          onPress={() => void submit.run()}
        />
      }
    >
      {note ? <Banner tone="info" message={note} /> : null}
      {error ? <Banner tone="danger" message={error} /> : null}
      <TextField
        label="Meal name"
        placeholder="e.g. My usual breakfast"
        value={d.name}
        onChangeText={(name) => set({ name })}
        maxLength={80}
      />
      <Text variant="small" color="textSecondary">
        Usually eaten at
      </Text>
      <SegmentedControl
        accessibilityLabel="Usually eaten at"
        options={[
          { value: 'any', label: 'Any' },
          ...MEAL_TYPES.map((m) => ({ value: m, label: MEAL_LABELS[m] })),
        ]}
        value={d.mealType ?? 'any'}
        onChange={(v) => set({ mealType: v === 'any' ? null : (v as MealType) })}
      />

      <SectionHeader title="Items" />
      {d.items.length === 0 ? (
        <Text color="textSecondary">
          Add foods, one of your recipes, or a quick item with your own numbers.
        </Text>
      ) : null}
      {d.items.map((it, k) =>
        editing === k ? (
          <ItemForm
            key={`edit-${k}`}
            initial={it}
            onDone={(next) => {
              set({ items: d.items.map((x, j) => (j === k ? next : x)) });
              setEditing(null);
            }}
            onCancel={() => setEditing(null)}
          />
        ) : (
          <AnimatedRow key={keys[k]}>
            <ListItem
              title={it.name}
              value={
                it.nutrition.kcal === null ? '— kcal' : `${Math.round(it.nutrition.kcal)} kcal`
              }
              subtitle={describe(it)}
              onPress={() => setEditing(k)}
            />
            <RowActions
              label={it.name}
              first={k === 0}
              last={k === d.items.length - 1}
              onMove={(dir) => set({ items: moveItem(d.items, k, dir) })}
              onRemove={() => set({ items: d.items.filter((_, j) => j !== k) })}
            />
          </AnimatedRow>
        ),
      )}

      {adding === 'food' ? (
        <FoodPicker
          confirmLabel="Add to meal"
          emptyHint="No foods found. Add a quick item with your own numbers instead."
          onPick={({ food, grams, per100 }) =>
            add({
              kind: 'food',
              name: food.name,
              foodId: food.id,
              recipeId: null,
              quantity: null,
              unit: 'g',
              grams,
              nutrition: per100
                ? nutritionForGrams(per100, grams)
                : { kcal: null, protein_g: null, carbs_g: null, fat_g: null, fibre_g: null },
              confidence: food.nutritional_confidence,
            })
          }
          onCancel={() => setAdding(null)}
        />
      ) : adding === 'recipe' ? (
        <RecipePicker onPick={add} onCancel={() => setAdding(null)} />
      ) : adding === 'quick' ? (
        <ItemForm
          initial={{
            kind: 'quick',
            name: '',
            foodId: null,
            recipeId: null,
            quantity: null,
            unit: null,
            grams: null,
            nutrition: { kcal: null, protein_g: null, carbs_g: null, fat_g: null, fibre_g: null },
            confidence: 'user',
          }}
          onDone={add}
          onCancel={() => setAdding(null)}
        />
      ) : (
        <View style={styles.wrap}>
          <Button
            title="Add food"
            variant="secondary"
            fullWidth={false}
            onPress={() => setAdding('food')}
          />
          <Button
            title="Add a recipe"
            variant="secondary"
            fullWidth={false}
            onPress={() => setAdding('recipe')}
          />
          <Button
            title="Quick item"
            variant="secondary"
            fullWidth={false}
            onPress={() => setAdding('quick')}
          />
        </View>
      )}

      {d.items.length ? (
        <Card>
          <Text variant="small" color="textSecondary">
            Whole meal
          </Text>
          <View style={styles.wrap}>
            <StatTile label="kcal" value={String(Math.round(t.kcal))} />
            <StatTile label="Protein" value={String(Math.round(t.protein_g))} unit="g" />
            <StatTile label="Carbs" value={String(Math.round(t.carbs_g))} unit="g" />
            <StatTile label="Fat" value={String(Math.round(t.fat_g))} unit="g" />
          </View>
          {t.partialItems ? (
            <Text variant="caption" color="warning">
              {t.partialItems === 1 ? '1 item has' : `${t.partialItems} items have`} incomplete
              nutrition, so totals may be low.
            </Text>
          ) : null}
        </Card>
      ) : null}
    </Screen>
  );
}

function describe(i: MealItem): string {
  const a = itemAmount(i);
  const amount = a
    ? `${Math.round(a.value * 100) / 100} ${a.value === 1 && a.unit === 'serving' ? 'serving' : a.unit === 'serving' ? 'servings' : a.unit}`
    : '';
  const what = i.kind === 'recipe' ? 'Recipe' : i.kind === 'quick' ? 'Quick item' : 'Food';
  const est = i.confidence === 'user_estimate' ? ' · your estimate' : '';
  return [what, amount].filter(Boolean).join(' · ') + est;
}

function ItemForm({
  initial,
  onDone,
  onCancel,
}: {
  initial: MealItem;
  onDone: (i: MealItem) => void;
  onCancel: () => void;
}) {
  const a = itemAmount(initial);
  const [amount, setAmount] = useState<number | null>(a?.value ?? null);
  const [name, setName] = useState(initial.name);
  const [n, setN] = useState(initial.nutrition);

  if (initial.kind !== 'quick' && a) {
    const ok = amount !== null && amount > 0 && amount <= (a.unit === 'g' ? 5000 : 50);
    return (
      <Card raised>
        <Text variant="bodyStrong">{initial.name}</Text>
        <NumberField
          label={
            a.unit === 'serving' ? 'Servings' : a.unit === 'g' ? 'Amount' : `Amount (${a.unit})`
          }
          suffix={a.unit === 'serving' ? undefined : a.unit}
          value={amount}
          onChangeValue={setAmount}
        />
        <Button
          title="Done"
          disabled={!ok}
          onPress={() => onDone(scaleMealItem(initial, amount as number))}
        />
        <Button title="Cancel" variant="ghost" onPress={onCancel} />
      </Card>
    );
  }
  const ok = name.trim().length > 0 && n.kcal !== null && n.kcal >= 0 && n.kcal <= 10000;
  return (
    <Card raised>
      <TextField
        label="Name"
        placeholder="e.g. Coffee with milk"
        value={name}
        onChangeText={setName}
        maxLength={120}
      />
      <NumberField
        label="Calories"
        suffix="kcal"
        value={n.kcal}
        onChangeValue={(kcal) => setN({ ...n, kcal })}
      />
      <View style={styles.row}>
        <View style={styles.flex}>
          <NumberField
            label="Protein (optional)"
            suffix="g"
            value={n.protein_g}
            onChangeValue={(protein_g) => setN({ ...n, protein_g })}
          />
        </View>
        <View style={styles.flex}>
          <NumberField
            label="Carbs (optional)"
            suffix="g"
            value={n.carbs_g}
            onChangeValue={(carbs_g) => setN({ ...n, carbs_g })}
          />
        </View>
        <View style={styles.flex}>
          <NumberField
            label="Fat (optional)"
            suffix="g"
            value={n.fat_g}
            onChangeValue={(fat_g) => setN({ ...n, fat_g })}
          />
        </View>
      </View>
      <Button
        title="Done"
        disabled={!ok}
        onPress={() =>
          onDone({
            ...initial,
            kind: initial.kind,
            name: name.trim(),
            nutrition: n,
            confidence: 'user',
          })
        }
      />
      <Button title="Cancel" variant="ghost" onPress={onCancel} />
    </Card>
  );
}

function RecipePicker({
  onPick,
  onCancel,
}: {
  onPick: (i: MealItem) => void;
  onCancel: () => void;
}) {
  const mine = useMyRecipes();
  const [picked, setPicked] = useState<string | null>(null);
  const [servings, setServings] = useState<number | null>(1);
  const withNutrition = mine.rows.filter((r) => r.kcal_per_serving !== null);
  const r = withNutrition.find((x) => x.id === picked);
  if (r) {
    const ok = servings !== null && servings > 0 && servings <= 20;
    return (
      <Card raised>
        <Text variant="bodyStrong">{r.name}</Text>
        <NumberField label="Servings" value={servings} precision={2} onChangeValue={setServings} />
        <Button
          title="Add to meal"
          disabled={!ok}
          onPress={() => onPick(recipeMealItem(r, servings as number))}
        />
        <Button title="Back" variant="ghost" onPress={() => setPicked(null)} />
      </Card>
    );
  }
  return (
    <Card raised>
      {mine.isPending ? <LoadingState /> : null}
      {!mine.isPending && withNutrition.length === 0 ? (
        <Text color="textSecondary">
          None of your recipes has nutrition yet. Add foods or your own estimate to a recipe first.
        </Text>
      ) : null}
      {withNutrition.map((x) => (
        <ListItem
          key={x.id}
          title={x.name}
          subtitle={`${Math.round(Number(x.kcal_per_serving))} kcal per serving${x.nutritional_confidence === 'user_estimate' ? ' (your estimate)' : ''}`}
          onPress={() => setPicked(x.id)}
        />
      ))}
      <Button title="Cancel" variant="ghost" onPress={onCancel} />
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.xs },
  flex: { flex: 1 },
  wrap: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' },
});

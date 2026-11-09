import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Banner, ErrorState, LoadingState, useToast } from '@/components/feedback';
import {
  Button,
  Card,
  ListItem,
  NumberField,
  Screen,
  SectionHeader,
  SegmentedControl,
  StatTile,
  Text,
  TextField,
} from '@/components/ui';
import { macroKcal } from '@/domain/calculations/targets';
import { formatAmount, parseMeasure } from '@/domain/nutrition/measure-parser';
import {
  type DraftIngredient,
  duplicateRecipe,
  emptyDraft,
  moveItem,
  nutritionForDraft,
  nutritionNote,
  type RecipeDraft,
  recipeDraftSchema,
  rowToDraft,
} from '@/domain/nutrition/recipe-draft';
import type { Nutrition } from '@/domain/nutrition/totals';
import { FoodPicker } from '@/features/nutrition/FoodPicker';
import { RowActions } from '@/features/nutrition/RowActions';
import {
  useFoodNutrition,
  useMyRecipes,
  useRecipe,
  useRecipeActions,
} from '@/features/nutrition/recipes-api';
import { useSubmit } from '@/hooks/useSubmit';
import { recipeErrorMessage } from '@/integrations/recipes/themealdb.provider';
import { spacing } from '@/theme';

/**
 * Create, edit or duplicate your own recipe.
 * ?id=<own recipe> edits it; ?from=<recipe id> or ?ext=<TheMealDB id> starts from a copy.
 */
export default function RecipeEditScreen() {
  const params = useLocalSearchParams<{ id?: string; from?: string; ext?: string }>();
  const sourceRef = params.id
    ? { id: params.id }
    : params.from
      ? { id: params.from }
      : params.ext
        ? { externalId: params.ext }
        : null;
  const source = useRecipe(sourceRef ?? {});
  const mine = useMyRecipes();

  if (!sourceRef) return <Editor initial={emptyDraft()} />;
  if (source.isPending)
    return (
      <Screen edges={['bottom']}>
        <LoadingState label="Loading recipe" />
      </Screen>
    );
  if (source.isError || !source.recipe)
    return (
      <Screen edges={['bottom']}>
        <ErrorState
          message={recipeErrorMessage(source.error)}
          onRetry={() => void source.refetch()}
        />
      </Screen>
    );
  const r = source.recipe;
  if (params.id) {
    if (r.source !== 'user')
      return (
        <Screen edges={['bottom']}>
          <ErrorState message="Only your own recipes can be edited. Make a copy instead." />
        </Screen>
      );
    return (
      <Editor
        key={r.id}
        initial={rowToDraft(r)}
        existing={{ id: r.id, onServer: mine.serverKeys.has(r.id) }}
      />
    );
  }
  return <Editor key={`copy-${r.id}`} initial={duplicateRecipe(r)} copiedFrom={r.name} />;
}

function Editor({
  initial,
  existing,
  copiedFrom,
}: {
  initial: RecipeDraft;
  existing?: { id: string; onServer: boolean };
  copiedFrom?: string;
}) {
  const actions = useRecipeActions();
  const showToast = useToast((s) => s.show);
  const [d, setD] = useState<RecipeDraft>(initial);
  const [tagsText, setTagsText] = useState(initial.tags.join(', '));
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState<'food' | 'text' | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const set = (patch: Partial<RecipeDraft>) => setD((prev) => ({ ...prev, ...patch }));

  // Recipes saved before ingredients kept a nutrition snapshot: fill it in from the foods table.
  const missing = d.ingredients.flatMap((i) => (i.kind === 'food' && !i.per100 ? [i.foodId] : []));
  const lookup = useFoodNutrition(missing);
  const ingredients = d.ingredients.map((i) =>
    i.kind === 'food' && !i.per100 && lookup.data?.[i.foodId]
      ? { ...i, per100: lookup.data[i.foodId] ?? null }
      : i,
  );
  const full: RecipeDraft = {
    ...d,
    ingredients,
    tags: tagsText
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean),
  };
  const n = nutritionForDraft(full);
  const note = nutritionNote(n);

  const save = async () => {
    const parsed = recipeDraftSchema.safeParse(full);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check the recipe.');
      return;
    }
    setError(null);
    const id = await actions.saveRecipe(full, existing);
    showToast(existing ? 'Recipe updated' : 'Recipe saved');
    router.replace({ pathname: '/nutrition/recipe/[id]', params: { id } });
  };
  const submit = useSubmit(save);

  const updateIngredient = (k: number, next: DraftIngredient) =>
    set({ ingredients: d.ingredients.map((x, j) => (j === k ? next : x)) });

  return (
    <Screen
      edges={['bottom']}
      footer={
        <Button
          title={existing ? 'Save changes' : 'Save recipe'}
          loading={submit.busy}
          onPress={() => void submit.run()}
        />
      }
    >
      {copiedFrom ? (
        <Banner
          tone="info"
          message={`A copy of “${copiedFrom}”. Change anything you like; the original stays as it is.`}
        />
      ) : null}
      {error ? <Banner tone="danger" message={error} /> : null}

      <TextField
        label="Recipe name"
        value={d.name}
        onChangeText={(name) => set({ name })}
        maxLength={200}
      />
      <TextField
        label="Description (optional)"
        value={d.description}
        onChangeText={(description) => set({ description })}
        multiline
        maxLength={2000}
      />
      <View style={styles.row}>
        <View style={styles.flex}>
          <NumberField
            label="Servings"
            decimal={false}
            precision={0}
            value={d.servings}
            onChangeValue={(v) => set({ servings: v ?? 0 })}
          />
        </View>
        <View style={styles.flex}>
          <NumberField
            label="Prep"
            suffix="min"
            decimal={false}
            precision={0}
            value={d.prepMinutes}
            onChangeValue={(prepMinutes) => set({ prepMinutes })}
          />
        </View>
        <View style={styles.flex}>
          <NumberField
            label="Cook"
            suffix="min"
            decimal={false}
            precision={0}
            value={d.cookMinutes}
            onChangeValue={(cookMinutes) => set({ cookMinutes })}
          />
        </View>
      </View>
      <TextField
        label="Tags (optional, separated by commas)"
        placeholder="e.g. family, quick, high protein"
        value={tagsText}
        onChangeText={setTagsText}
        autoCorrect={false}
      />

      <SectionHeader title="Ingredients" />
      {d.ingredients.length === 0 ? (
        <Text color="textSecondary">
          Add foods from the database for calculated nutrition, or type ingredients as you would
          write them.
        </Text>
      ) : null}
      {ingredients.map((it, k) =>
        editing === k ? (
          <IngredientForm
            key={`edit-${k}`}
            initial={it}
            onDone={(next) => {
              updateIngredient(k, next);
              setEditing(null);
            }}
            onCancel={() => setEditing(null)}
          />
        ) : (
          <View key={`${it.name}-${k}`}>
            <ListItem
              title={it.name}
              value={it.kind === 'food' ? `${it.grams} g` : it.amount || undefined}
              subtitle={
                it.kind === 'food'
                  ? it.per100
                    ? 'From the food database'
                    : 'Food without nutrition data'
                  : 'Typed in · no nutrition'
              }
              onPress={() => setEditing(k)}
            />
            <RowActions
              label={it.name}
              first={k === 0}
              last={k === d.ingredients.length - 1}
              onMove={(dir) => set({ ingredients: moveItem(d.ingredients, k, dir) })}
              onRemove={() => set({ ingredients: d.ingredients.filter((_, j) => j !== k) })}
            />
          </View>
        ),
      )}
      {adding === 'food' ? (
        <FoodPicker
          onPick={({ food, grams, per100 }) => {
            set({
              ingredients: [
                ...d.ingredients,
                { kind: 'food', foodId: food.id, name: food.name, grams, per100 },
              ],
            });
            setAdding(null);
          }}
          onCancel={() => setAdding(null)}
        />
      ) : adding === 'text' ? (
        <IngredientForm
          initial={{ kind: 'text', name: '', amount: '' }}
          onDone={(ing) => {
            set({ ingredients: [...d.ingredients, ing] });
            setAdding(null);
          }}
          onCancel={() => setAdding(null)}
        />
      ) : (
        <View style={styles.row}>
          <View style={styles.flex}>
            <Button title="Add from foods" variant="secondary" onPress={() => setAdding('food')} />
          </View>
          <View style={styles.flex}>
            <Button
              title="Type an ingredient"
              variant="secondary"
              onPress={() => setAdding('text')}
            />
          </View>
        </View>
      )}

      <SectionHeader title="Method" />
      {d.steps.map((step, k) => (
        <View key={k}>
          <TextField
            label={`Step ${k + 1}`}
            value={step}
            onChangeText={(v) => set({ steps: d.steps.map((s, j) => (j === k ? v : s)) })}
            multiline
            maxLength={500}
          />
          <RowActions
            label={`step ${k + 1}`}
            first={k === 0}
            last={k === d.steps.length - 1}
            onMove={(dir) => set({ steps: moveItem(d.steps, k, dir) })}
            onRemove={() => set({ steps: d.steps.filter((_, j) => j !== k) })}
          />
        </View>
      ))}
      <Button
        title="Add a step"
        variant="secondary"
        disabled={d.steps.length >= 40}
        onPress={() => set({ steps: [...d.steps, ''] })}
      />

      <SectionHeader title="Nutrition per serving" />
      <SegmentedControl
        accessibilityLabel="Nutrition"
        options={[
          { value: 'calculated', label: 'Calculate' },
          { value: 'estimate', label: 'My own estimate' },
        ]}
        value={d.nutritionMode}
        onChange={(nutritionMode) => set({ nutritionMode })}
      />
      {d.nutritionMode === 'calculated' ? (
        n.perServing ? (
          <Card>
            <NutritionTiles value={n.perServing} />
            {note ? (
              <Text variant="caption" color={n.covered < n.total ? 'warning' : 'textSecondary'}>
                {note}
              </Text>
            ) : null}
          </Card>
        ) : (
          <Banner
            tone="info"
            title="No nutrition yet"
            message="Add foods from the database to calculate it, or enter your own estimate. Typed-in ingredients never get made-up numbers."
          />
        )
      ) : (
        <EstimateFields value={d.estimate} onChange={(estimate) => set({ estimate })} />
      )}

      <TextField
        label="Link to the original (optional)"
        placeholder="https://"
        value={d.sourceUrl ?? ''}
        onChangeText={(v) => set({ sourceUrl: v.trim() ? v.trim() : null })}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        maxLength={500}
      />
    </Screen>
  );
}

function IngredientForm({
  initial,
  onDone,
  onCancel,
}: {
  initial: DraftIngredient;
  onDone: (i: DraftIngredient) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial.name);
  const [amount, setAmount] = useState(initial.kind === 'text' ? initial.amount : '');
  const [grams, setGrams] = useState<number | null>(initial.kind === 'food' ? initial.grams : null);
  if (initial.kind === 'food') {
    const ok = grams !== null && grams > 0 && grams <= 5000;
    return (
      <Card raised>
        <Text variant="bodyStrong">{initial.name}</Text>
        <NumberField label="Amount" suffix="g" value={grams} onChangeValue={setGrams} />
        <Button
          title="Done"
          disabled={!ok}
          onPress={() => onDone({ ...initial, grams: grams as number })}
        />
        <Button title="Cancel" variant="ghost" onPress={onCancel} />
      </Card>
    );
  }
  const m = parseMeasure(amount);
  const hint = !amount.trim()
    ? 'Leave empty if there’s no amount.'
    : m.status === 'parsed' && m.quantityMin !== null
      ? `Understood as ${formatAmount(m.quantityMin, m.quantityMax, m.unit)}; it will scale with servings.`
      : m.status === 'to_taste'
        ? 'To taste: not scaled.'
        : 'Kept exactly as written; it won’t scale with servings.';
  return (
    <Card raised>
      <TextField
        label="Ingredient"
        placeholder="e.g. plain flour"
        value={name}
        onChangeText={setName}
        maxLength={200}
      />
      <TextField
        label="Amount (optional)"
        placeholder="e.g. 2 cups, 1 tbsp, a pinch, to taste"
        value={amount}
        onChangeText={setAmount}
        maxLength={60}
      />
      <Text variant="caption" color="textSecondary">
        {hint}
      </Text>
      <Button
        title="Done"
        disabled={!name.trim()}
        onPress={() => onDone({ kind: 'text', name: name.trim(), amount: amount.trim() })}
      />
      <Button title="Cancel" variant="ghost" onPress={onCancel} />
    </Card>
  );
}

function NutritionTiles({ value }: { value: Nutrition }) {
  const fmt = (v: number | null) => (v === null ? '—' : String(Math.round(v)));
  return (
    <View style={styles.tiles}>
      <StatTile label="kcal" value={fmt(value.kcal)} />
      <StatTile label="Protein" value={fmt(value.protein_g)} unit="g" />
      <StatTile label="Carbs" value={fmt(value.carbs_g)} unit="g" />
      <StatTile label="Fat" value={fmt(value.fat_g)} unit="g" />
    </View>
  );
}

function EstimateFields({
  value,
  onChange,
}: {
  value: Nutrition;
  onChange: (n: Nutrition) => void;
}) {
  const { kcal, protein_g: p, carbs_g: c, fat_g: f } = value;
  const fromMacros = p !== null && c !== null && f !== null ? Math.round(macroKcal(p, c, f)) : null;
  return (
    <Card>
      <Text variant="small" color="textSecondary">
        Your own numbers for one serving, for example from a package or another app. They are shown
        as your estimate.
      </Text>
      <NumberField
        label="Calories"
        suffix="kcal"
        value={kcal}
        onChangeValue={(v) => onChange({ ...value, kcal: v })}
      />
      <View style={styles.row}>
        <View style={styles.flex}>
          <NumberField
            label="Protein (optional)"
            suffix="g"
            value={p}
            onChangeValue={(v) => onChange({ ...value, protein_g: v })}
          />
        </View>
        <View style={styles.flex}>
          <NumberField
            label="Carbs (optional)"
            suffix="g"
            value={c}
            onChangeValue={(v) => onChange({ ...value, carbs_g: v })}
          />
        </View>
      </View>
      <View style={styles.row}>
        <View style={styles.flex}>
          <NumberField
            label="Fat (optional)"
            suffix="g"
            value={f}
            onChangeValue={(v) => onChange({ ...value, fat_g: v })}
          />
        </View>
        <View style={styles.flex}>
          <NumberField
            label="Fibre (optional)"
            suffix="g"
            value={value.fibre_g}
            onChangeValue={(v) => onChange({ ...value, fibre_g: v })}
          />
        </View>
      </View>
      {fromMacros !== null &&
      kcal !== null &&
      Math.abs(fromMacros - kcal) > Math.max(20, kcal * 0.15) ? (
        <Banner
          tone="warning"
          message={`Macros add up to about ${fromMacros} kcal, but you entered ${kcal}. Check for a typo.`}
        />
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.xs },
  flex: { flex: 1 },
  tiles: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' },
});

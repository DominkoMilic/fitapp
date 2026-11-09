import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { goBack } from '@/navigation/back';
import { isSafeExternalUrl, openExternalUrl } from '@/navigation/external-link';
import { Banner, ConfirmDialog, ErrorState, LoadingState, useToast } from '@/components/feedback';
import {
  Button,
  Card,
  NumberField,
  Screen,
  SectionHeader,
  SegmentedControl,
  StatTile,
  Text,
} from '@/components/ui';
import { scaleMeasure } from '@/domain/nutrition/measure-parser';
import { readIngredients } from '@/domain/nutrition/recipe-ingredients';
import { addDays } from '@/domain/calculations/dates';
import { type MealType, mealTypeForTime } from '@/domain/nutrition/totals';
import { useToday } from '@/features/dashboard/useToday';
import { type LogItemInput, useNutritionActions } from '@/features/nutrition/api';
import { MealPicker } from '@/features/nutrition/MealPicker';
import { useSubmit } from '@/hooks/useSubmit';
import {
  type RecipeRow,
  useRecipe,
  useRecipeActions,
  useSavedRecipes,
} from '@/features/nutrition/recipes-api';
import { useRecipeFlagger } from '@/features/nutrition/usePreferencesFlags';
import { usePreferences } from '@/features/profile/api';
import { recipeErrorMessage } from '@/integrations/recipes/themealdb.provider';
import { radius, spacing } from '@/theme';
import { recipeImage } from '@/integrations/recipes/images';

export default function RecipeDetail() {
  const params = useLocalSearchParams<{ id: string; ext?: string }>();
  const ref = params.id && params.id !== 'ext' ? { id: params.id } : { externalId: params.ext };
  const { recipe, isPending, isError, error, refetch } = useRecipe(ref);
  if (isPending)
    return (
      <Screen edges={['bottom']}>
        <LoadingState label="Loading recipe" />
      </Screen>
    );
  if (isError || !recipe)
    return (
      <Screen edges={['bottom']}>
        <ErrorState message={recipeErrorMessage(error)} onRetry={() => void refetch()} />
      </Screen>
    );
  return <RecipeView recipe={recipe} />;
}

function RecipeView({ recipe }: { recipe: RecipeRow }) {
  const { today, hour } = useToday();
  const { data: prefs } = usePreferences();
  const saved = useSavedRecipes();
  const actions = useRecipeActions();
  const log = useNutritionActions();
  const flag = useRecipeFlagger();
  const showToast = useToast((s) => s.show);
  const savedRow = saved.rows.find((s) => s.recipe_id === recipe.id);
  const isUser = recipe.source === 'user';
  const stated = recipe.servings_stated;
  const [askedBase, setAskedBase] = useState<number | null>(null);
  const base = stated ?? savedRow?.base_servings ?? askedBase;
  const [servings, setServings] = useState<number>(
    savedRow?.default_servings ?? prefs?.household_servings ?? 1,
  );
  const [custom, setCustom] = useState(false);
  const ingredients = readIngredients(recipe.ingredients);
  const factor = base ? servings / base : 1;
  const flags = flag(ingredients.map((i) => i.name));
  const isEstimate = recipe.nutritional_confidence === 'user_estimate';
  const hasNutrition =
    (recipe.nutritional_confidence === 'calculated' || isEstimate) &&
    recipe.kcal_per_serving !== null;
  const foodRows = ingredients.filter((i) => i.foodId && i.grams !== null).length;
  const nutritionCaption = isEstimate
    ? 'Your estimate'
    : foodRows < ingredients.length
      ? `Calculated from ${foodRows} of ${ingredients.length} ingredients — the rest have no nutrition data`
      : 'Calculated from your ingredients';
  const [logging, setLogging] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const persist = (values: { base_servings: number | null; default_servings: number | null }) =>
    void actions.save(recipe.id, saved.serverKeys.has(recipe.id), values);

  return (
    <Screen edges={['bottom']}>
      {recipeImage(recipe.image_url) ? (
        <Image
          source={{ uri: recipeImage(recipe.image_url) as string }}
          style={styles.image}
          accessibilityIgnoresInvertColors
          accessibilityLabel={recipe.name}
        />
      ) : null}
      <Text variant="heading" accessibilityRole="header">
        {recipe.name}
      </Text>
      <Text color="textSecondary">
        {[
          recipe.category,
          recipe.cuisine,
          recipe.cooking_minutes ? `${recipe.cooking_minutes} min` : null,
        ]
          .filter(Boolean)
          .join(' · ')}
      </Text>
      {flags.dietWarnings.length || flags.matches.length ? (
        <Banner
          tone={flags.exclude ? 'warning' : 'info'}
          message={`${[...flags.dietWarnings, ...flags.matches.map((m) => `Contains ${m}`)].join('. ')}. Always check ingredients yourself.`}
        />
      ) : null}

      {isUser ? (
        <View style={styles.row}>
          <View style={styles.flex}>
            <Button
              title="Edit"
              variant="secondary"
              onPress={() =>
                router.push({ pathname: '/nutrition/recipe-edit', params: { id: recipe.id } })
              }
            />
          </View>
          <View style={styles.flex}>
            <Button
              title="Duplicate"
              variant="secondary"
              onPress={() =>
                router.push({ pathname: '/nutrition/recipe-edit', params: { from: recipe.id } })
              }
            />
          </View>
        </View>
      ) : (
        <>
          <Button
            title={savedRow ? 'Saved ✓ (tap to remove)' : 'Save recipe'}
            variant="secondary"
            onPress={() =>
              savedRow
                ? void actions.unsave(recipe.id, saved.serverKeys.has(recipe.id))
                : persist({ base_servings: base, default_servings: servings })
            }
          />
          <Button
            title="Make it my own"
            variant="secondary"
            accessibilityHint="Copies this recipe so you can change it and add nutrition"
            onPress={() =>
              router.push({
                pathname: '/nutrition/recipe-edit',
                params: recipe.id ? { from: recipe.id } : { ext: recipe.external_id ?? '' },
              })
            }
          />
        </>
      )}

      <SectionHeader title="Nutrition per serving" />
      {hasNutrition ? (
        <View style={styles.row}>
          <StatTile label="kcal" value={String(Math.round(Number(recipe.kcal_per_serving)))} />
          <StatTile label="Protein" value={fmtMacro(recipe.protein_per_serving)} unit="g" />
          <StatTile label="Carbs" value={fmtMacro(recipe.carbs_per_serving)} unit="g" />
          <StatTile label="Fat" value={fmtMacro(recipe.fat_per_serving)} unit="g" />
        </View>
      ) : null}
      {hasNutrition && isUser ? (
        <Text variant="caption" color="textSecondary">
          {nutritionCaption}
        </Text>
      ) : null}
      {hasNutrition ? null : (
        <Banner
          tone="info"
          title="Nutrition unavailable"
          message={
            isUser
              ? 'Edit the recipe to add foods from the database or enter your own estimate.'
              : "The source doesn't provide nutrition. Log it with your own estimate, or make it your own and add foods for exact numbers."
          }
        />
      )}

      <SectionHeader title="Servings" />
      {!base ? (
        <Card raised>
          <Text>
            How many servings does this recipe make? The source doesn&apos;t say, so amounts
            can&apos;t be scaled until you tell us.
          </Text>
          <SegmentedControl
            accessibilityLabel="Original servings"
            options={['1', '2', '4', '6', '8'].map((v) => ({ value: v, label: v }))}
            value={null}
            onChange={(v) => {
              setAskedBase(Number(v));
              if (savedRow) persist({ base_servings: Number(v), default_servings: servings });
            }}
          />
        </Card>
      ) : (
        <>
          <SegmentedControl
            accessibilityLabel="Cooking for"
            options={[
              ...['1', '2', '3', '4'].map((v) => ({ value: v, label: v === '1' ? '1 person' : v })),
              { value: 'custom', label: 'Custom' },
            ]}
            value={custom ? 'custom' : String(servings)}
            onChange={(v) => {
              if (v === 'custom') return setCustom(true);
              setCustom(false);
              setServings(Number(v));
            }}
          />
          {custom ? (
            <NumberField
              label="Servings"
              decimal={false}
              precision={0}
              value={servings}
              onChangeValue={(v) => v && v > 0 && v <= 20 && setServings(v)}
            />
          ) : null}
          <Text variant="caption" color="textSecondary">
            Original makes {base}. Amounts below are for {servings}.
            {!isUser && !stated ? ' (Your estimate of the original.)' : ''}
          </Text>
        </>
      )}

      <SectionHeader title="Ingredients" />
      <Card>
        {ingredients.map((i, k) => {
          const s = scaleMeasure(i.measure, factor);
          return (
            <Text key={`${i.name}-${k}`} variant="small">
              • {i.name}
              {s.text ? `: ${s.text}` : ''}
              {i.measure.status === 'unparsed' && factor !== 1 ? ' (not scaled)' : ''}
            </Text>
          );
        })}
      </Card>
      {recipe.instructions.length ? <SectionHeader title="Method" /> : null}
      {recipe.instructions.map((step, k) => (
        <Text key={k}>
          {k + 1}. {step}
        </Text>
      ))}

      {hasNutrition ? (
        logging ? (
          <LogSheet
            recipe={recipe}
            estimate={isEstimate}
            defaultMeal={mealTypeForTime(hour * 60)}
            today={today}
            onLog={async (input) => {
              await log.logItem(input);
              setLogging(false);
              showToast(
                input.quantity === 1
                  ? 'Serving logged'
                  : `${formatServings(input.quantity)} servings logged`,
              );
            }}
            onCancel={() => setLogging(false)}
          />
        ) : (
          <Button title="Log servings" onPress={() => setLogging(true)} />
        )
      ) : (
        <Button
          title="Log with my own estimate"
          variant="secondary"
          onPress={() =>
            router.push({
              pathname: '/nutrition/quick-add',
              params: { meal: mealTypeForTime(hour * 60), name: recipe.name },
            })
          }
        />
      )}
      {!isUser ? (
        <>
          <Text variant="caption" color="textSecondary">
            Recipe from TheMealDB.
          </Text>
          {isSafeExternalUrl(recipe.source_url) ? (
            <Button
              title="View original recipe"
              variant="ghost"
              fullWidth={false}
              onPress={() => void openExternalUrl(recipe.source_url)}
            />
          ) : null}
          {isSafeExternalUrl(recipe.video_url) ? (
            <Button
              title="Watch video"
              variant="ghost"
              fullWidth={false}
              onPress={() => void openExternalUrl(recipe.video_url)}
            />
          ) : null}
        </>
      ) : (
        <Button
          title="Remove recipe"
          variant="ghost"
          fullWidth={false}
          onPress={() => setConfirmRemove(true)}
        />
      )}
      <ConfirmDialog
        visible={confirmRemove}
        title="Remove this recipe?"
        message="It disappears from your recipes. Meals you already logged keep their numbers."
        confirmLabel="Remove"
        destructive
        onCancel={() => setConfirmRemove(false)}
        onConfirm={() => {
          setConfirmRemove(false);
          void actions.archiveRecipe(recipe).then(() => {
            showToast('Recipe removed');
            goBack('/nutrition/recipes');
          });
        }}
      />
    </Screen>
  );
}

const fmtMacro = (v: number | string | null) => (v === null ? '—' : String(Math.round(Number(v))));
const formatServings = (v: number | null) => (v === null ? '' : String(Math.round(v * 100) / 100));

/** Log a number of servings (0.25 steps) of a recipe to a meal on today or one of the two days before. */
function LogSheet({
  recipe,
  estimate,
  defaultMeal,
  today,
  onLog,
  onCancel,
}: {
  recipe: RecipeRow;
  estimate: boolean;
  defaultMeal: MealType;
  today: string;
  onLog: (input: LogItemInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [servings, setServings] = useState<number | null>(1);
  const [meal, setMeal] = useState<MealType>(defaultMeal);
  const [day, setDay] = useState<'0' | '1' | '2'>('0');
  const ok = servings !== null && servings > 0 && servings <= 20;
  const per = (v: number | string | null) => (v === null ? null : Number(v));
  const times = (v: number | null) =>
    v === null || !ok ? null : Math.round(v * (servings as number) * 10) / 10;
  const kcal = times(per(recipe.kcal_per_serving));
  const submit = useSubmit(() =>
    onLog({
      date: addDays(today, -Number(day)),
      meal,
      name: recipe.name,
      foodId: null,
      recipeId: recipe.id,
      quantity: servings,
      unit: 'serving',
      grams: null,
      nutrition: {
        kcal,
        protein_g: times(per(recipe.protein_per_serving)),
        carbs_g: times(per(recipe.carbs_per_serving)),
        fat_g: times(per(recipe.fat_per_serving)),
        fibre_g: times(per(recipe.fibre_per_serving)),
      },
      source: 'recipe',
      confidence: estimate ? 'user_estimate' : 'calculated',
    }),
  );
  return (
    <Card raised>
      <NumberField
        label="Servings"
        value={servings}
        precision={2}
        onChangeValue={(v) => setServings(v === null ? null : Math.round(v * 4) / 4)}
        hint="In steps of a quarter serving"
      />
      <SegmentedControl
        accessibilityLabel="Day"
        options={[
          { value: '0', label: 'Today' },
          { value: '1', label: 'Yesterday' },
          { value: '2', label: '2 days ago' },
        ]}
        value={day}
        onChange={setDay}
      />
      <MealPicker value={meal} onChange={setMeal} />
      <Text variant="caption" color="textSecondary">
        {kcal === null
          ? 'Enter servings above 0 and up to 20.'
          : `${Math.round(kcal)} kcal${estimate ? ' (your estimate)' : ''}`}
      </Text>
      <Button title="Log" disabled={!ok} loading={submit.busy} onPress={() => void submit.run()} />
      <Button title="Cancel" variant="ghost" onPress={onCancel} />
    </Card>
  );
}

const styles = StyleSheet.create({
  image: { width: '100%', aspectRatio: 16 / 10, borderRadius: radius.card },
  row: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' },
  flex: { flex: 1 },
});

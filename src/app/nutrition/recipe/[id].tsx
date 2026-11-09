import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Image, Linking, StyleSheet, View } from 'react-native';

import { Banner, ErrorState, LoadingState, useToast } from '@/components/feedback';
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
import { mealTypeForTime } from '@/domain/nutrition/totals';
import { useToday } from '@/features/dashboard/useToday';
import { useNutritionActions } from '@/features/nutrition/api';
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
  const hasNutrition =
    recipe.nutritional_confidence === 'calculated' && recipe.kcal_per_serving !== null;

  const persist = (values: { base_servings: number | null; default_servings: number | null }) =>
    void actions.save(recipe.id, saved.serverKeys.has(recipe.id), values);

  return (
    <Screen edges={['bottom']}>
      {recipe.image_url ? (
        <Image
          source={{ uri: recipe.image_url }}
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

      <Button
        title={savedRow ? 'Saved ✓ (tap to remove)' : 'Save recipe'}
        variant={savedRow ? 'secondary' : 'primary'}
        onPress={() =>
          savedRow
            ? void actions.unsave(recipe.id, saved.serverKeys.has(recipe.id))
            : persist({ base_servings: base, default_servings: servings })
        }
      />

      <SectionHeader title="Nutrition per serving" />
      {hasNutrition ? (
        <View style={styles.row}>
          <StatTile label="kcal" value={String(Math.round(Number(recipe.kcal_per_serving)))} />
          <StatTile
            label="Protein"
            value={String(Math.round(Number(recipe.protein_per_serving ?? 0)))}
            unit="g"
          />
          <StatTile
            label="Carbs"
            value={String(Math.round(Number(recipe.carbs_per_serving ?? 0)))}
            unit="g"
          />
          <StatTile
            label="Fat"
            value={String(Math.round(Number(recipe.fat_per_serving ?? 0)))}
            unit="g"
          />
        </View>
      ) : (
        <Banner
          tone="info"
          title="Nutrition unavailable"
          message="The source doesn't provide nutrition. Log it with your own estimate, or rebuild it as your own recipe from foods for exact numbers."
        />
      )}

      <SectionHeader title="Servings" />
      {!base ? (
        <Card raised>
          <Text>
            How many servings does this recipe make? The source doesn&apos;t say, so amounts can&apos;t be
            scaled until you tell us.
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
        <Button
          title="Log 1 serving"
          onPress={() =>
            void log
              .logItem({
                date: today,
                meal: mealTypeForTime(hour * 60),
                name: recipe.name,
                foodId: null,
                recipeId: recipe.id,
                quantity: 1,
                unit: 'serving',
                grams: null,
                nutrition: {
                  kcal: Number(recipe.kcal_per_serving),
                  protein_g:
                    recipe.protein_per_serving === null ? null : Number(recipe.protein_per_serving),
                  carbs_g:
                    recipe.carbs_per_serving === null ? null : Number(recipe.carbs_per_serving),
                  fat_g: recipe.fat_per_serving === null ? null : Number(recipe.fat_per_serving),
                  fibre_g:
                    recipe.fibre_per_serving === null ? null : Number(recipe.fibre_per_serving),
                },
                source: 'recipe',
                confidence: 'calculated',
              })
              .then(() => showToast('Serving logged'))
          }
        />
      ) : (
        <Button
          title="Log with my own estimate"
          variant="secondary"
          onPress={() =>
            router.push({
              pathname: '/nutrition/quick-add',
              params: { meal: mealTypeForTime(hour * 60) },
            })
          }
        />
      )}
      {!isUser ? (
        <>
          <Text variant="caption" color="textSecondary">
            Recipe from TheMealDB.
          </Text>
          {recipe.source_url ? (
            <Button
              title="View original recipe"
              variant="ghost"
              fullWidth={false}
              onPress={() => void Linking.openURL(recipe.source_url as string)}
            />
          ) : null}
          {recipe.video_url ? (
            <Button
              title="Watch video"
              variant="ghost"
              fullWidth={false}
              onPress={() => void Linking.openURL(recipe.video_url as string)}
            />
          ) : null}
        </>
      ) : (
        <Button
          title="Remove recipe"
          variant="ghost"
          fullWidth={false}
          onPress={() => void actions.archiveRecipe(recipe).then(() => router.back())}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  image: { width: '100%', aspectRatio: 16 / 10, borderRadius: radius.card },
  row: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' },
});

import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Banner, useToast } from '@/components/feedback';
import {
  Button,
  Card,
  ListItem,
  NumberField,
  Screen,
  SectionHeader,
  StatTile,
  Text,
  TextField,
} from '@/components/ui';
import { type Food, useCustomFoods, useFoodSearch } from '@/features/nutrition/api';
import {
  type RecipeIngredientInput,
  recipeNutrition,
  useRecipeActions,
} from '@/features/nutrition/recipes-api';
import { spacing } from '@/theme';

/** Build a recipe from foods + grams; nutrition per serving is calculated (spec 12.5). */
export default function NewRecipe() {
  const actions = useRecipeActions();
  const showToast = useToast((s) => s.show);
  const [name, setName] = useState('');
  const [servings, setServings] = useState<number | null>(4);
  const [minutes, setMinutes] = useState<number | null>(null);
  const [method, setMethod] = useState('');
  const [items, setItems] = useState<RecipeIngredientInput[]>([]);
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<Food | null>(null);
  const [grams, setGrams] = useState<number | null>(100);
  const [error, setError] = useState<string | null>(null);
  const search = useFoodSearch(query);
  const custom = useCustomFoods();
  const options = [
    ...custom.rows.filter(
      (f) => query.trim().length >= 2 && f.name.toLowerCase().includes(query.trim().toLowerCase()),
    ),
    ...(search.data ?? []).filter((f) => f.owner_id === null),
  ].slice(0, 12);
  const n = recipeNutrition(items, servings ?? 1);

  const save = async () => {
    if (!name.trim()) return setError('Enter a name.');
    if (!servings || servings < 1 || servings > 50)
      return setError('Servings must be between 1 and 50.');
    if (!items.length) return setError('Add at least one ingredient.');
    const id = await actions.createRecipe({
      name,
      servings,
      minutes,
      instructions: method
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean),
      ingredients: items,
    });
    showToast('Recipe created');
    router.replace({ pathname: '/nutrition/recipe/[id]', params: { id } });
  };

  return (
    <Screen edges={['bottom']} footer={<Button title="Save recipe" onPress={() => void save()} />}>
      {error ? <Banner tone="danger" message={error} /> : null}
      <TextField label="Recipe name" value={name} onChangeText={setName} maxLength={200} />
      <View style={styles.row}>
        <View style={styles.flex}>
          <NumberField
            label="Servings"
            decimal={false}
            precision={0}
            value={servings}
            onChangeValue={setServings}
          />
        </View>
        <View style={styles.flex}>
          <NumberField
            label="Time (optional)"
            suffix="min"
            decimal={false}
            precision={0}
            value={minutes}
            onChangeValue={setMinutes}
          />
        </View>
      </View>

      <SectionHeader title="Ingredients" />
      {items.map((it, k) => (
        <ListItem
          key={`${it.food.id}-${k}`}
          title={it.food.name}
          value={`${it.grams} g`}
          subtitle="Tap to remove"
          onPress={() => setItems(items.filter((_, j) => j !== k))}
        />
      ))}
      {picked ? (
        <Card raised>
          <Text variant="bodyStrong">{picked.name}</Text>
          <NumberField label="Amount" suffix="g" value={grams} onChangeValue={setGrams} />
          <Button
            title="Add ingredient"
            disabled={!grams || grams <= 0 || grams > 5000}
            onPress={() => {
              setItems([...items, { food: picked, grams: grams as number }]);
              setPicked(null);
              setQuery('');
              setGrams(100);
            }}
          />
          <Button title="Cancel" variant="ghost" onPress={() => setPicked(null)} />
        </Card>
      ) : (
        <>
          <TextField
            label="Add an ingredient"
            placeholder="Search foods"
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
          />
          {search.isError ? (
            <Banner
              tone="warning"
              message="Food search needs a connection. Your own foods still appear."
            />
          ) : null}
          {options.map((f) => (
            <ListItem
              key={f.id}
              title={f.name}
              subtitle={`${f.kcal === null ? '—' : Math.round(Number(f.kcal))} kcal per 100 g`}
              onPress={() => setPicked(f)}
            />
          ))}
        </>
      )}

      {items.length ? (
        <Card>
          <Text variant="small" color="textSecondary">
            Per serving (of {servings ?? '—'})
          </Text>
          <View style={styles.row}>
            <StatTile
              label="kcal"
              value={n.perServing.kcal === null ? '—' : String(Math.round(n.perServing.kcal))}
            />
            <StatTile
              label="Protein"
              value={
                n.perServing.protein_g === null ? '—' : String(Math.round(n.perServing.protein_g))
              }
              unit="g"
            />
          </View>
          {n.partial ? (
            <Text variant="caption" color="warning">
              {n.partial} ingredient(s) lack full data; totals may be low.
            </Text>
          ) : null}
        </Card>
      ) : null}

      <TextField
        label="Method (optional, one step per line)"
        value={method}
        onChangeText={setMethod}
        multiline
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.xs },
  flex: { flex: 1 },
});

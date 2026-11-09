import { router } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { Banner, EmptyState, LoadingState } from '@/components/feedback';
import {
  Button,
  ChipGroup,
  ListItem,
  Screen,
  SegmentedControl,
  Text,
  TextField,
} from '@/components/ui';
import { recipeErrorMessage } from '@/integrations/recipes/themealdb.provider';
import {
  useMyRecipes,
  useRecipeBrowse,
  useRecipeCategories,
  useRecipesByIds,
  useSavedRecipes,
} from '@/features/nutrition/recipes-api';
import { radius, spacing, useTheme } from '@/theme';

type Tab = 'saved' | 'mine' | 'browse';

export default function Recipes() {
  const [tab, setTab] = useState<Tab>('saved');
  return (
    <Screen
      edges={['bottom']}
      footer={
        <Button
          title="Create my own recipe"
          variant="secondary"
          onPress={() => router.push('/nutrition/recipe-new')}
        />
      }
    >
      <SegmentedControl<Tab>
        accessibilityLabel="Recipe list"
        options={[
          { value: 'saved', label: 'Saved' },
          { value: 'mine', label: 'My recipes' },
          { value: 'browse', label: 'Browse' },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'saved' ? (
        <SavedTab onBrowse={() => setTab('browse')} />
      ) : tab === 'mine' ? (
        <MineTab />
      ) : (
        <BrowseTab />
      )}
    </Screen>
  );
}

const openRecipe = (params: { id?: string; ext?: string }) =>
  router.push({
    pathname: '/nutrition/recipe/[id]',
    params: { id: params.id ?? 'ext', ext: params.ext },
  });

function SavedTab({ onBrowse }: { onBrowse: () => void }) {
  const saved = useSavedRecipes();
  const recipes = useRecipesByIds(saved.rows.map((s) => s.recipe_id));
  if (saved.isPending) return <LoadingState />;
  if (!saved.rows.length)
    return (
      <EmptyState
        title="No saved recipes"
        message="Save recipes you like and they'll be here, also offline."
        actionLabel="Browse recipes"
        onAction={onBrowse}
      />
    );
  return (
    <>
      {saved.rows.map((s) => {
        const r = recipes.data?.find((x) => x.id === s.recipe_id);
        return (
          <ListItem
            key={s.recipe_id}
            title={r?.name ?? 'Loading…'}
            subtitle={r?.cuisine ?? r?.category ?? undefined}
            onPress={() => openRecipe({ id: s.recipe_id })}
          />
        );
      })}
    </>
  );
}

function MineTab() {
  const mine = useMyRecipes();
  if (mine.isPending) return <LoadingState />;
  if (!mine.rows.length) {
    return (
      <EmptyState
        title="No recipes yet"
        message="Build a recipe from foods and PACE calculates its nutrition per serving."
        actionLabel="Create a recipe"
        onAction={() => router.push('/nutrition/recipe-new')}
      />
    );
  }
  return (
    <>
      {mine.rows.map((r) => (
        <ListItem
          key={r.id}
          title={r.name}
          subtitle={`${r.kcal_per_serving === null ? '—' : Math.round(Number(r.kcal_per_serving))} kcal · P ${r.protein_per_serving === null ? '—' : Math.round(Number(r.protein_per_serving))} g per serving${r._pending ? ' · not synced yet' : ''}`}
          onPress={() => openRecipe({ id: r.id })}
        />
      ))}
    </>
  );
}

function BrowseTab() {
  const { colors } = useTheme();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const categories = useRecipeCategories();
  const results = useRecipeBrowse(
    category && !query.trim() ? { kind: 'category', category } : { kind: 'search', query },
  );
  const active = query.trim().length >= 2 || !!category;
  return (
    <>
      <TextField
        label="Search recipes"
        placeholder="e.g. chicken, pasta, curry"
        value={query}
        onChangeText={setQuery}
        autoCorrect={false}
      />
      {categories.data ? (
        <ChipGroup
          accessibilityLabel="Categories"
          options={categories.data.map((c) => ({ value: c, label: c }))}
          selected={category ? [category] : []}
          onToggle={(c) => {
            setQuery('');
            setCategory(category === c ? null : c);
          }}
        />
      ) : null}
      {categories.isError ? (
        <Banner tone="warning" message={recipeErrorMessage(categories.error)} />
      ) : null}
      {active && results.isPending ? <LoadingState label="Searching recipes" /> : null}
      {results.isError ? (
        <Banner tone="warning" message={recipeErrorMessage(results.error)} />
      ) : null}
      {active && results.isSuccess && !results.data.length ? (
        <EmptyState title="No recipes found" message="Try another word or category." />
      ) : null}
      {results.data?.map((r) => (
        <Pressable
          key={r.externalId}
          accessibilityRole="button"
          accessibilityLabel={r.name}
          onPress={() => openRecipe({ ext: r.externalId })}
          style={[styles.row, { borderBottomColor: colors.border }]}
        >
          {r.imageUrl ? (
            <Image
              source={{ uri: `${r.imageUrl}/small` }}
              style={styles.thumb}
              accessibilityIgnoresInvertColors
            />
          ) : (
            <View style={[styles.thumb, { backgroundColor: colors.surfaceRaised }]} />
          )}
          <Text variant="body" style={styles.flex}>
            {r.name}
          </Text>
        </Pressable>
      ))}
      {results.data?.length ? (
        <Text variant="caption" color="textSecondary">
          Recipes from TheMealDB. Nutrition isn&apos;t provided by the source.
        </Text>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  thumb: { width: 56, height: 56, borderRadius: radius.input },
  flex: { flex: 1 },
});

import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';

import { Banner, EmptyState, LoadingState } from '@/components/feedback';
import { Button, ListItem, Screen, SectionHeader, TextField } from '@/components/ui';
import { MEAL_LABELS } from '@/domain/nutrition/totals';
import { useToday } from '@/features/dashboard/useToday';
import { type Food, useCustomFoods, useFoodSearch, useRecentItems } from '@/features/nutrition/api';
import { asDate, asMeal } from '@/features/nutrition/params';

const per100 = (f: Pick<Food, 'kcal' | 'protein_g' | 'basis'>) =>
  `${f.kcal === null ? '—' : Math.round(Number(f.kcal))} kcal${f.protein_g !== null ? ` · P ${Number(f.protein_g)} g` : ''} per 100 ${f.basis === 'per_100ml' ? 'ml' : 'g'}`;

export default function AddFood() {
  const params = useLocalSearchParams<{ date?: string; meal?: string }>();
  const { today } = useToday();
  const date = asDate(params.date, today);
  const meal = asMeal(params.meal);
  const [query, setQuery] = useState('');
  const search = useFoodSearch(query);
  const custom = useCustomFoods();
  const recent = useRecentItems();
  const q = query.trim().toLowerCase();

  // Recently logged foods (distinct by food or name), for one-tap re-logging. Works offline.
  const recentFoods = useMemo(() => {
    const seen = new Set<string>();
    return recent.rows
      .filter((r) => {
        const key = r.food_id ?? `name:${r.name_snapshot}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return !q || r.name_snapshot.toLowerCase().includes(q);
      })
      .slice(0, 12);
  }, [recent.rows, q]);
  const myFoods = custom.rows.filter((f) => !q || f.name.toLowerCase().includes(q));
  const results = (search.data ?? []).filter((f) => f.owner_id === null);
  const open = (id: string) =>
    router.push({ pathname: '/nutrition/food/[id]', params: { id, date, meal } });

  return (
    <Screen
      edges={['bottom']}
      footer={
        <>
          <Button
            title="Quick add calories"
            variant="secondary"
            onPress={() =>
              router.push({ pathname: '/nutrition/quick-add', params: { date, meal } })
            }
          />
          <Button
            title="Create a food"
            variant="ghost"
            onPress={() => router.push({ pathname: '/nutrition/food-new', params: { date, meal } })}
          />
        </>
      }
    >
      <TextField
        label={`Search foods for ${MEAL_LABELS[meal].toLowerCase()}`}
        placeholder="e.g. egg, oats, chicken breast"
        value={query}
        onChangeText={setQuery}
        autoFocus
        autoCorrect={false}
      />
      {myFoods.length ? <SectionHeader title="My foods" /> : null}
      {myFoods.map((f) => (
        <ListItem key={f.id} title={f.name} subtitle={per100(f)} onPress={() => open(f.id)} />
      ))}
      {recentFoods.length ? <SectionHeader title="Recent" /> : null}
      {recentFoods.map((r) =>
        r.food_id ? (
          <ListItem
            key={r.id}
            title={r.name_snapshot}
            subtitle={`Last: ${Number(r.quantity ?? r.grams ?? 0)} ${r.unit ?? 'g'}`}
            onPress={() => open(r.food_id as string)}
          />
        ) : null,
      )}
      {q.length >= 2 ? <SectionHeader title="Food database" /> : null}
      {q.length >= 2 && search.isPending ? <LoadingState label="Searching" /> : null}
      {search.isError ? (
        <Banner
          tone="warning"
          message="Search needs a connection. Your foods, recent items and quick add still work offline."
        />
      ) : null}
      {q.length >= 2 && search.isSuccess && !results.length && !myFoods.length ? (
        <EmptyState title="No matches" message="Try a simpler word, or create the food yourself." />
      ) : null}
      {results.map((f) => (
        <ListItem key={f.id} title={f.name} subtitle={per100(f)} onPress={() => open(f.id)} />
      ))}
      {results.length ? (
        <Banner tone="info" message="Food data: USDA FoodData Central (public domain)." />
      ) : null}
    </Screen>
  );
}

import { useState } from 'react';

import { Banner } from '@/components/feedback';
import { Button, Card, ListItem, NumberField, Text, TextField } from '@/components/ui';
import type { Per100 } from '@/domain/nutrition/totals';
import { type Food, useCustomFoods, useFoodSearch } from '@/features/nutrition/api';

export interface PickedFood {
  food: Food;
  grams: number;
  per100: Per100 | null;
}

const num = (v: number | string | null) => (v === null ? null : Number(v));

/** Search reference + your own foods, then enter grams. Used by the recipe and meal editors. */
export function FoodPicker({
  onPick,
  onCancel,
  confirmLabel = 'Add ingredient',
  emptyHint = 'No foods found. You can type the ingredient instead.',
}: {
  onPick: (p: PickedFood) => void;
  onCancel: () => void;
  confirmLabel?: string;
  emptyHint?: string;
}) {
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<Food | null>(null);
  const [grams, setGrams] = useState<number | null>(100);
  const search = useFoodSearch(query);
  const custom = useCustomFoods();
  const q = query.trim().toLowerCase();
  const options = [
    ...custom.rows.filter((f) => q.length >= 2 && f.name.toLowerCase().includes(q)),
    ...(search.data ?? []).filter((f) => f.owner_id === null),
  ].slice(0, 12);

  if (picked) {
    const ok = grams !== null && grams > 0 && grams <= 5000;
    return (
      <Card raised>
        <Text variant="bodyStrong">{picked.name}</Text>
        <NumberField label="Amount" suffix="g" value={grams} onChangeValue={setGrams} />
        <Button
          title={confirmLabel}
          disabled={!ok}
          onPress={() =>
            onPick({
              food: picked,
              grams: grams as number,
              per100:
                picked.kcal === null
                  ? null
                  : {
                      kcal: num(picked.kcal),
                      protein_g: num(picked.protein_g),
                      carbs_g: num(picked.carbs_g),
                      fat_g: num(picked.fat_g),
                      fibre_g: num(picked.fibre_g),
                    },
            })
          }
        />
        <Button title="Back to search" variant="ghost" onPress={() => setPicked(null)} />
      </Card>
    );
  }
  return (
    <Card raised>
      <TextField
        label="Search foods"
        placeholder="e.g. chicken breast"
        value={query}
        onChangeText={setQuery}
        autoCorrect={false}
        autoFocus
      />
      {search.isError ? (
        <Banner
          tone="warning"
          message="Food search needs a connection. Your own foods still appear."
        />
      ) : null}
      {q.length >= 2 && !search.isPending && options.length === 0 ? (
        <Text color="textSecondary">{emptyHint}</Text>
      ) : null}
      {options.map((f) => (
        <ListItem
          key={f.id}
          title={f.name}
          subtitle={`${f.kcal === null ? '—' : Math.round(Number(f.kcal))} kcal per 100 g`}
          onPress={() => setPicked(f)}
        />
      ))}
      <Button title="Cancel" variant="ghost" onPress={onCancel} />
    </Card>
  );
}

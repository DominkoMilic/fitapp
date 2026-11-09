import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { goBack } from '@/navigation/back';
import { Banner, useToast } from '@/components/feedback';
import { Button, NumberField, Screen, Text, TextField } from '@/components/ui';
import { useToday } from '@/features/dashboard/useToday';
import { useNutritionActions } from '@/features/nutrition/api';
import { MealPicker } from '@/features/nutrition/MealPicker';
import { asDate, asMeal } from '@/features/nutrition/params';
import { useSubmit } from '@/hooks/useSubmit';

/** Calories (and optional macros) without a food, e.g. a restaurant meal (spec 12.2). */
export default function QuickAdd() {
  const params = useLocalSearchParams<{ date?: string; meal?: string }>();
  const { today } = useToday();
  const actions = useNutritionActions();
  const showToast = useToast((s) => s.show);
  const [meal, setMeal] = useState(asMeal(params.meal));
  const [name, setName] = useState('');
  const [kcal, setKcal] = useState<number | null>(null);
  const [p, setP] = useState<number | null>(null);
  const [c, setC] = useState<number | null>(null);
  const [f, setF] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (kcal === null || kcal <= 0 || kcal > 10000)
      return setError('Enter calories between 1 and 10,000.');
    if ([p, c, f].some((v) => v !== null && (v < 0 || v > 1000)))
      return setError('Macros must be between 0 and 1000 g.');
    await actions.logItem({
      date: asDate(params.date, today),
      meal,
      name: name.trim() || 'Quick add',
      foodId: null,
      quantity: null,
      unit: null,
      grams: null,
      nutrition: { kcal, protein_g: p, carbs_g: c, fat_g: f, fibre_g: null },
      source: 'quick_add',
      confidence: 'user',
    });
    goBack('/nutrition');
    showToast('Added');
  };
  const submit = useSubmit(save);

  return (
    <Screen
      edges={['bottom']}
      footer={<Button title="Add" loading={submit.busy} onPress={() => void submit.run()} />}
    >
      {error ? <Banner tone="danger" message={error} /> : null}
      <MealPicker value={meal} onChange={setMeal} />
      <TextField
        label="Name (optional)"
        placeholder="e.g. Burek from the bakery"
        value={name}
        onChangeText={setName}
        maxLength={200}
      />
      <NumberField
        label="Calories"
        suffix="kcal"
        decimal={false}
        precision={0}
        value={kcal}
        onChangeValue={setKcal}
      />
      <Text variant="small" color="textSecondary">
        Macros (optional; leave empty if unknown)
      </Text>
      <NumberField label="Protein" suffix="g" value={p} onChangeValue={setP} />
      <NumberField label="Carbohydrates" suffix="g" value={c} onChangeValue={setC} />
      <NumberField label="Fat" suffix="g" value={f} onChangeValue={setF} />
    </Screen>
  );
}

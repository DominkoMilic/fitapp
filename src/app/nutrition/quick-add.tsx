import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { goBack } from '@/navigation/back';
import { Banner, useToast } from '@/components/feedback';
import { Button, NumberField, Screen, Text, TextField } from '@/components/ui';
import { useToday } from '@/features/dashboard/useToday';
import { useNutritionActions } from '@/features/nutrition/api';
import { MealPicker } from '@/features/nutrition/MealPicker';
import { asDate, asMeal } from '@/features/nutrition/params';
import { type FieldErrors, useFieldErrors } from '@/hooks/useFieldErrors';
import { useSubmit } from '@/hooks/useSubmit';

/** Calories (and optional macros) without a food, e.g. a restaurant meal (spec 12.2). */
export default function QuickAdd() {
  const params = useLocalSearchParams<{ date?: string; meal?: string; name?: string }>();
  const { today } = useToday();
  const actions = useNutritionActions();
  const showToast = useToast((s) => s.show);
  const [meal, setMeal] = useState(asMeal(params.meal));
  const [name, setName] = useState((params.name ?? '').slice(0, 120));
  const [kcal, setKcal] = useState<number | null>(null);
  const [p, setP] = useState<number | null>(null);
  const [c, setC] = useState<number | null>(null);
  const [f, setF] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  type Field = 'kcal' | 'p' | 'c' | 'f';
  const fields = useFieldErrors<Field>();
  const macroError = (v: number | null) =>
    v !== null && (v < 0 || v > 1000) ? 'Must be between 0 and 1000 g' : undefined;

  const save = async () => {
    setError(null);
    const e: FieldErrors<Field> = {};
    if (kcal === null || kcal <= 0 || kcal > 10000) e.kcal = 'Enter calories between 1 and 10,000';
    const [ep, ec, ef] = [macroError(p), macroError(c), macroError(f)];
    if (ep) e.p = ep;
    if (ec) e.c = ec;
    if (ef) e.f = ef;
    if (!fields.show(e) || kcal === null) return;
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
        onChangeValue={(v) => {
          setKcal(v);
          fields.clear('kcal');
        }}
        error={fields.errors.kcal}
      />
      <Text variant="small" color="textSecondary">
        Macros (optional; leave empty if unknown)
      </Text>
      <NumberField
        label="Protein"
        suffix="g"
        value={p}
        onChangeValue={(v) => {
          setP(v);
          fields.clear('p');
        }}
        error={fields.errors.p}
      />
      <NumberField
        label="Carbohydrates"
        suffix="g"
        value={c}
        onChangeValue={(v) => {
          setC(v);
          fields.clear('c');
        }}
        error={fields.errors.c}
      />
      <NumberField
        label="Fat"
        suffix="g"
        value={f}
        onChangeValue={(v) => {
          setF(v);
          fields.clear('f');
        }}
        error={fields.errors.f}
        onSubmitEditing={() => void submit.run()}
      />
    </Screen>
  );
}

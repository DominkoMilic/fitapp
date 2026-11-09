import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { Banner, ErrorState, LoadingState, useToast } from '@/components/feedback';
import { Button, NumberField, Screen, SegmentedControl, Text, TextField } from '@/components/ui';
import { macroKcal } from '@/domain/calculations/targets';
import {
  type Food,
  portionsOf,
  useCustomFoods,
  useFood,
  useNutritionActions,
} from '@/features/nutrition/api';
import { goBack } from '@/navigation/back';
import { useSubmit } from '@/hooks/useSubmit';

/**
 * Custom food per 100 g/ml, with an optional named portion (e.g. "1 cup = 170 g").
 * With ?id= it edits one of your foods; entries you already logged keep their numbers.
 */
export default function FoodForm() {
  const params = useLocalSearchParams<{ id?: string; date?: string; meal?: string }>();
  const { food, isPending, isError, refetch } = useFood(params.id);
  if (!params.id) return <Form date={params.date} meal={params.meal} />;
  if (isPending)
    return (
      <Screen edges={['bottom']}>
        <LoadingState />
      </Screen>
    );
  if (isError || !food || !food.owner_id)
    return (
      <Screen edges={['bottom']}>
        <ErrorState
          message={
            food && !food.owner_id
              ? 'Only your own foods can be edited.'
              : "We couldn't load this food."
          }
          onRetry={food ? undefined : () => void refetch()}
        />
      </Screen>
    );
  return <Form key={food.id} existing={food} />;
}

const n = (v: number | string | null | undefined) =>
  v === null || v === undefined ? null : Number(v);

function Form({ existing, date, meal }: { existing?: Food; date?: string; meal?: string }) {
  const actions = useNutritionActions();
  const custom = useCustomFoods();
  const showToast = useToast((s) => s.show);
  const firstPortion = existing ? portionsOf(existing)[0] : undefined;
  const [name, setName] = useState(existing?.name ?? '');
  const [brand, setBrand] = useState(existing?.brand ?? '');
  const [basis, setBasis] = useState<'per_100g' | 'per_100ml'>(
    existing?.basis === 'per_100ml' ? 'per_100ml' : 'per_100g',
  );
  const [kcal, setKcal] = useState<number | null>(n(existing?.kcal));
  const [p, setP] = useState<number | null>(n(existing?.protein_g));
  const [c, setC] = useState<number | null>(n(existing?.carbs_g));
  const [f, setF] = useState<number | null>(n(existing?.fat_g));
  const [fibre, setFibre] = useState<number | null>(n(existing?.fibre_g));
  const [portionLabel, setPortionLabel] = useState(firstPortion?.label ?? '');
  const [portionGrams, setPortionGrams] = useState<number | null>(firstPortion?.grams ?? null);
  const [error, setError] = useState<string | null>(null);
  const u = basis === 'per_100ml' ? 'ml' : 'g';

  const save = async () => {
    if (!name.trim()) return setError('Enter a name.');
    if (kcal === null || kcal < 0 || kcal > 950)
      return setError('Calories per 100 must be between 0 and 950.');
    if ([p, c, f, fibre].some((v) => v !== null && (v < 0 || v > 100)))
      return setError('Macros per 100 must be between 0 and 100 g.');
    if ((p ?? 0) + (c ?? 0) + (f ?? 0) > 100)
      return setError('Protein + carbs + fat cannot exceed 100 g per 100.');
    if (portionLabel.trim() && !(portionGrams && portionGrams > 0))
      return setError('Enter the grams for the portion.');
    const id = await actions.saveFood(
      {
        name,
        brand: brand || null,
        basis,
        kcal,
        protein_g: p,
        carbs_g: c,
        fat_g: f,
        fibre_g: fibre,
        portions:
          portionLabel.trim() && portionGrams
            ? [{ label: portionLabel.trim().slice(0, 80), grams: portionGrams }]
            : [],
      },
      existing ? { id: existing.id, onServer: custom.serverKeys.has(existing.id) } : undefined,
    );
    if (existing) {
      showToast('Food updated');
      goBack('/nutrition/add');
      return;
    }
    showToast('Food created');
    router.replace({ pathname: '/nutrition/food/[id]', params: { id, date, meal } });
  };
  const submit = useSubmit(save);
  const fromMacros = p !== null && c !== null && f !== null ? Math.round(macroKcal(p, c, f)) : null;

  return (
    <Screen
      edges={['bottom']}
      footer={
        <Button
          title={existing ? 'Save changes' : 'Create food'}
          loading={submit.busy}
          onPress={() => void submit.run()}
        />
      }
    >
      {error ? <Banner tone="danger" message={error} /> : null}
      {existing ? (
        <Text variant="small" color="textSecondary">
          Changes apply to new entries. Food you already logged keeps its numbers.
        </Text>
      ) : null}
      <TextField
        label="Name"
        placeholder="e.g. Skyr natural"
        value={name}
        onChangeText={setName}
        maxLength={200}
      />
      <TextField label="Brand (optional)" value={brand} onChangeText={setBrand} maxLength={100} />
      <SegmentedControl
        accessibilityLabel="Values per"
        options={[
          { value: 'per_100g', label: 'Per 100 g' },
          { value: 'per_100ml', label: 'Per 100 ml' },
        ]}
        value={basis}
        onChange={setBasis}
      />
      <Text variant="small" color="textSecondary">
        Copy the values from the package label (per 100 {u}).
      </Text>
      <NumberField label="Calories" suffix="kcal" value={kcal} onChangeValue={setKcal} />
      <NumberField label="Protein" suffix="g" value={p} onChangeValue={setP} />
      <NumberField label="Carbohydrates" suffix="g" value={c} onChangeValue={setC} />
      <NumberField label="Fat" suffix="g" value={f} onChangeValue={setF} />
      <NumberField label="Fibre (optional)" suffix="g" value={fibre} onChangeValue={setFibre} />
      {fromMacros !== null &&
      kcal !== null &&
      Math.abs(fromMacros - kcal) > Math.max(20, kcal * 0.15) ? (
        <Banner
          tone="warning"
          message={`Macros add up to about ${fromMacros} kcal, but you entered ${kcal}. Check for a typo.`}
        />
      ) : null}
      <Text variant="small" color="textSecondary">
        Portion (optional)
      </Text>
      <TextField
        label="Portion name"
        placeholder="e.g. 1 cup"
        value={portionLabel}
        onChangeText={setPortionLabel}
        maxLength={80}
      />
      <NumberField
        label="Portion weight"
        suffix={u}
        value={portionGrams}
        onChangeValue={setPortionGrams}
      />
    </Screen>
  );
}

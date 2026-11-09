import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Banner, ConfirmDialog, ErrorState, LoadingState, useToast } from '@/components/feedback';
import { Button, Card, ChipGroup, NumberField, Screen, StatTile, Text } from '@/components/ui';
import { checkGrams, nutritionForGrams, MEAL_LABELS } from '@/domain/nutrition/totals';
import { useToday } from '@/features/dashboard/useToday';
import { portionsOf, useCustomFoods, useFood, useNutritionActions } from '@/features/nutrition/api';
import { goBack } from '@/navigation/back';
import { MealPicker } from '@/features/nutrition/MealPicker';
import { asDate, asMeal } from '@/features/nutrition/params';
import { spacing } from '@/theme';
import { useSubmit } from '@/hooks/useSubmit';

export default function FoodAmount() {
  const params = useLocalSearchParams<{ id: string; date?: string; meal?: string }>();
  const { today } = useToday();
  const { food, isPending, isError, refetch } = useFood(params.id);
  const actions = useNutritionActions();
  const showToast = useToast((s) => s.show);
  const [meal, setMeal] = useState(asMeal(params.meal));
  const [portion, setPortion] = useState<string>('grams');
  const [amount, setAmount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmLarge, setConfirmLarge] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const custom = useCustomFoods();
  const date = asDate(params.date, today);
  const submit = useSubmit(
    async (
      f: NonNullable<typeof food>,
      g: number,
      portionInfo: { label: string; count: number } | null,
    ) => {
      await actions.logFood(date, meal, f, g, portionInfo);
      // Back to the diary (not the search screen), where the new entry shows up.
      router.dismissTo('/nutrition');
      showToast(`Added to ${MEAL_LABELS[meal].toLowerCase()}`);
    },
  );

  if (isPending)
    return (
      <Screen edges={['bottom']}>
        <LoadingState />
      </Screen>
    );
  if (isError || !food)
    return (
      <Screen edges={['bottom']}>
        <ErrorState message="We couldn't load this food." onRetry={() => void refetch()} />
      </Screen>
    );

  const portions = portionsOf(food);
  const chosen = portions.find((p) => p.label === portion);
  const unit = food.basis === 'per_100ml' ? 'ml' : 'g';
  const value = amount ?? (chosen ? 1 : 100);
  const grams = chosen ? chosen.grams * value : value;
  const n = nutritionForGrams(food, grams);

  const save = () =>
    submit.run(
      food,
      Math.round(grams * 10) / 10,
      chosen ? { label: chosen.label, count: value } : null,
    );
  const onAdd = () => {
    const c = checkGrams(grams);
    if (!c.ok)
      return setError(
        c.reason === 'too_large'
          ? 'That is more than 5 kg. Check the amount.'
          : 'Enter an amount above zero.',
      );
    setError(null);
    if (c.confirm) setConfirmLarge(true);
    else void save();
  };

  return (
    <Screen
      edges={['bottom']}
      footer={<Button title="Add" loading={submit.busy} onPress={onAdd} />}
    >
      <Text variant="title">{food.name}</Text>
      <Text variant="small" color="textSecondary">
        {food.source === 'usda'
          ? 'USDA reference data'
          : food.source === 'off'
            ? 'Crowdsourced data: check the package'
            : 'Your food'}
      </Text>
      {food.owner_id ? (
        <View style={styles.row}>
          <Button
            title="Edit food"
            variant="ghost"
            fullWidth={false}
            onPress={() =>
              router.push({ pathname: '/nutrition/food-new', params: { id: food.id } })
            }
          />
          <Button
            title="Remove"
            variant="ghost"
            fullWidth={false}
            accessibilityLabel={`Remove ${food.name}`}
            onPress={() => setConfirmRemove(true)}
          />
        </View>
      ) : null}
      {error ? <Banner tone="danger" message={error} /> : null}
      {food.kcal === null ||
      food.protein_g === null ||
      food.carbs_g === null ||
      food.fat_g === null ? (
        <Banner
          tone="warning"
          message="This food is missing some nutrition values. Totals will show it as partial."
        />
      ) : null}
      <MealPicker value={meal} onChange={setMeal} />
      {portions.length ? (
        <ChipGroup
          accessibilityLabel="Portion"
          options={[
            { value: 'grams', label: unit === 'ml' ? 'Millilitres' : 'Grams' },
            ...portions.map((p) => ({ value: p.label, label: `${p.label} (${p.grams} g)` })),
          ]}
          selected={[portion]}
          onToggle={(v) => {
            setPortion(v);
            setAmount(null);
          }}
        />
      ) : null}
      <NumberField
        label={chosen ? `Number of portions (${chosen.label})` : `Amount (${unit})`}
        suffix={chosen ? '×' : unit}
        value={value}
        onChangeValue={setAmount}
      />
      <Card>
        <Text variant="small" color="textSecondary">
          {chosen ? `${Math.round(grams)} ${unit} total` : 'Nutrition'}
        </Text>
        <View style={styles.row}>
          <StatTile label="kcal" value={n.kcal === null ? '—' : String(Math.round(n.kcal))} />
          <StatTile
            label="Protein"
            value={n.protein_g === null ? '—' : String(n.protein_g)}
            unit="g"
          />
        </View>
        <View style={styles.row}>
          <StatTile label="Carbs" value={n.carbs_g === null ? '—' : String(n.carbs_g)} unit="g" />
          <StatTile label="Fat" value={n.fat_g === null ? '—' : String(n.fat_g)} unit="g" />
        </View>
      </Card>
      <ConfirmDialog
        visible={confirmRemove}
        title="Remove this food?"
        message="It disappears from search and your foods. Entries you already logged keep their numbers."
        confirmLabel="Remove"
        destructive
        onCancel={() => setConfirmRemove(false)}
        onConfirm={() => {
          setConfirmRemove(false);
          void actions.archiveFood(food, custom.serverKeys.has(food.id)).then(() => {
            showToast('Food removed');
            goBack('/nutrition/add');
          });
        }}
      />
      <ConfirmDialog
        visible={confirmLarge}
        title="Large amount"
        message={`${Math.round(grams)} ${unit} is a lot for one entry. Add it anyway?`}
        confirmLabel="Add"
        onCancel={() => setConfirmLarge(false)}
        onConfirm={() => {
          setConfirmLarge(false);
          void save();
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: 'row', gap: spacing.xs } });

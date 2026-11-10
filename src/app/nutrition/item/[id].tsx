import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { goBack } from '@/navigation/back';
import { ConfirmDialog, ErrorState, LoadingState } from '@/components/feedback';
import { Button, Card, NumberField, Screen, Text } from '@/components/ui';
import { checkGrams } from '@/domain/nutrition/totals';
import { useToday } from '@/features/dashboard/useToday';
import { type MealLogItem, useDayLog, useNutritionActions } from '@/features/nutrition/api';
import { MealPicker } from '@/features/nutrition/MealPicker';
import { asDate, asMeal } from '@/features/nutrition/params';
import { useFieldErrors } from '@/hooks/useFieldErrors';
import { useSubmit } from '@/hooks/useSubmit';

export default function EditItem() {
  const params = useLocalSearchParams<{ id: string; date?: string }>();
  const { today } = useToday();
  const log = useDayLog(asDate(params.date, today));
  const item = log.rows.find((r) => r.id === params.id);
  if (log.isPending)
    return (
      <Screen edges={['bottom']}>
        <LoadingState />
      </Screen>
    );
  if (!item)
    return (
      <Screen edges={['bottom']}>
        <ErrorState title="Not found" message="This entry no longer exists." />
      </Screen>
    );
  return <EditForm item={item} onServer={log.serverKeys.has(item.id)} />;
}

const scale = (v: number | string | null, f: number) =>
  v === null ? null : Math.round(Number(v) * f * 10) / 10;

function EditForm({ item, onServer }: { item: MealLogItem; onServer: boolean }) {
  const actions = useNutritionActions();
  const [meal, setMeal] = useState(asMeal(item.meal_type));
  const baseGrams = item.grams === null ? null : Number(item.grams);
  const [grams, setGrams] = useState<number | null>(baseGrams);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const fields = useFieldErrors<'amount'>();
  const save = async () => {
    let changes: Partial<MealLogItem> = { meal_type: meal };
    if (baseGrams !== null && grams !== null && grams !== baseGrams) {
      const c = checkGrams(grams);
      if (!c.ok) {
        fields.show({ amount: 'Enter an amount between 1 and 5000 g' });
        return;
      }
      // Scales the stored snapshot; the original food is not consulted (history stays consistent).
      const f = grams / baseGrams;
      changes = {
        ...changes,
        grams,
        quantity:
          item.unit === 'g' || item.unit === 'ml'
            ? grams
            : item.quantity === null
              ? null
              : Math.round(Number(item.quantity) * f * 100) / 100,
        kcal: scale(item.kcal, f),
        protein_g: scale(item.protein_g, f),
        carbs_g: scale(item.carbs_g, f),
        fat_g: scale(item.fat_g, f),
        fibre_g: scale(item.fibre_g, f),
      };
    }
    await actions.updateItem(item, changes);
    goBack('/nutrition');
  };
  const submit = useSubmit(save);

  return (
    <Screen
      edges={['bottom']}
      footer={<Button title="Save" loading={submit.busy} onPress={() => void submit.run()} />}
    >
      <Text variant="title">{item.name_snapshot}</Text>
      <MealPicker value={meal} onChange={setMeal} />
      {baseGrams !== null ? (
        <NumberField
          label="Amount"
          suffix={item.unit === 'ml' ? 'ml' : 'g'}
          value={grams}
          onChangeValue={(v) => {
            setGrams(v);
            fields.clear('amount');
          }}
          error={fields.errors.amount}
        />
      ) : (
        <Text color="textSecondary">
          Quick-add entries can be moved or deleted. To change the calories, delete and add again.
        </Text>
      )}
      <Card>
        <Text variant="small" color="textSecondary">
          Logged nutrition
        </Text>
        <Text>
          {item.kcal === null ? '—' : Math.round(Number(item.kcal))} kcal · P{' '}
          {item.protein_g ?? '—'} g · C {item.carbs_g ?? '—'} g · F {item.fat_g ?? '—'} g
        </Text>
      </Card>
      <Button title="Delete entry" variant="ghost" onPress={() => setConfirmDelete(true)} />
      <ConfirmDialog
        visible={confirmDelete}
        destructive
        title="Delete this entry?"
        message="It's removed from this day's log."
        confirmLabel="Delete"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => {
          await actions.deleteItem(item, onServer);
          setConfirmDelete(false);
          goBack('/nutrition');
        }}
      />
    </Screen>
  );
}

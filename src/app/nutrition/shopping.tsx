import { useLocalSearchParams } from 'expo-router';
import { CircleCheck, Circle } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Banner, ConfirmDialog, EmptyState, LoadingState, useToast } from '@/components/feedback';
import { Button, Card, Screen, Text, TextField } from '@/components/ui';
import { formatAmount } from '@/domain/nutrition/measure-parser';
import { useToday } from '@/features/dashboard/useToday';
import { useSavedMeals } from '@/features/nutrition/api';
import { asDate } from '@/features/nutrition/params';
import {
  shoppingSources,
  type ShoppingItem,
  usePlanEntries,
  usePlannerActions,
  useShoppingItems,
  useShoppingLists,
} from '@/features/nutrition/planner-api';
import { useMyRecipes, useRecipesByIds, useSavedRecipes } from '@/features/nutrition/recipes-api';
import { dayLabel } from '@/features/training/labels';
import { radius, spacing, TOUCH_TARGET, useTheme } from '@/theme';
import { addDays } from '@/domain/calculations/dates';

const qty = (it: ShoppingItem) => {
  if (it.raw_text) return it.raw_text;
  if (it.quantity_min === null) return '';
  return formatAmount(
    Number(it.quantity_min),
    it.quantity_max === null ? null : Number(it.quantity_max),
    it.unit,
  );
};

export default function Shopping() {
  const params = useLocalSearchParams<{ from?: string; to?: string }>();
  const { today } = useToday();
  const from = asDate(params.from, today);
  const to = asDate(params.to, addDays(from, 6));
  const lists = useShoppingLists();
  const list = lists.rows[0];
  const items = useShoppingItems(list?.id);
  const plan = usePlanEntries(from, to);
  const mine = useMyRecipes();
  const saved = useSavedRecipes();
  const savedRows = useRecipesByIds(
    plan.rows.map((e) => e.recipe_id).filter((x): x is string => !!x),
  );
  const savedMeals = useSavedMeals();
  const actions = usePlannerActions();
  const showToast = useToast((s) => s.show);
  const { colors } = useTheme();
  const [manual, setManual] = useState('');
  const [confirmNew, setConfirmNew] = useState(false);

  const built = useMemo(() => {
    const recipes = new Map([...mine.rows, ...(savedRows.data ?? [])].map((r) => [r.id, r]));
    return shoppingSources({
      entries: plan.rows,
      recipes,
      saved: new Map(saved.rows.map((s) => [s.recipe_id, s])),
      savedMeals: new Map(savedMeals.rows.map((m) => [m.id, m])),
    });
  }, [plan.rows, mine.rows, savedRows.data, saved.rows, savedMeals.rows]);

  const generate = async () => {
    await actions.createShoppingList(`Week of ${dayLabel(from, '')}`, from, to, built.sources);
    if (list) await actions.archiveList(list);
    setConfirmNew(false);
    showToast('Shopping list created');
  };

  if (lists.isPending)
    return (
      <Screen edges={['bottom']}>
        <LoadingState />
      </Screen>
    );
  const sorted = [...items.rows].sort(
    (a, b) => Number(a.is_checked) - Number(b.is_checked) || a.sort_index - b.sort_index,
  );

  return (
    <Screen edges={['bottom']}>
      {!list ? (
        <EmptyState
          title="No shopping list yet"
          message={
            built.sources.length
              ? `Create one from ${built.sources.length} planned meal(s) for ${dayLabel(from, '')} – ${dayLabel(to, '')}.`
              : 'Plan some meals with recipes or saved meals first.'
          }
          actionLabel={built.sources.length ? 'Create shopping list' : undefined}
          onAction={built.sources.length ? () => void generate() : undefined}
        />
      ) : (
        <>
          <Text variant="title">{list.name}</Text>
          {built.unscaled.length ? (
            <Banner
              tone="info"
              message={`Original servings unknown for: ${built.unscaled.join(', ')}. Amounts are for the whole recipe.`}
            />
          ) : null}
          {sorted.length === 0 && items.isPending ? <LoadingState /> : null}
          {sorted.map((it) => (
            <Pressable
              key={it.id}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: it.is_checked }}
              accessibilityLabel={`${it.ingredient_name} ${qty(it)}`}
              onPress={() => void actions.toggleItem(it)}
              style={[styles.item, { borderColor: colors.border, backgroundColor: colors.surface }]}
            >
              {it.is_checked ? (
                <CircleCheck size={22} color={colors.accent} />
              ) : (
                <Circle size={22} color={colors.textSecondary} />
              )}
              <View style={styles.flex}>
                <Text
                  variant="body"
                  color={it.is_checked ? 'textSecondary' : 'textPrimary'}
                  style={it.is_checked ? styles.done : undefined}
                >
                  {it.ingredient_name}
                </Text>
                {qty(it) ? (
                  <Text variant="small" color="textSecondary">
                    {qty(it)}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          ))}
          <Card>
            <TextField
              label="Add an item"
              value={manual}
              onChangeText={setManual}
              maxLength={200}
              onSubmitEditing={() =>
                manual.trim() &&
                void actions.addManualItem(list.id, manual, sorted.length).then(() => setManual(''))
              }
            />
            <Button
              title="Add"
              variant="secondary"
              disabled={!manual.trim()}
              onPress={() =>
                void actions.addManualItem(list.id, manual, sorted.length).then(() => setManual(''))
              }
            />
          </Card>
          {built.sources.length ? (
            <Button
              title="Rebuild from this week's plan"
              variant="ghost"
              onPress={() => setConfirmNew(true)}
            />
          ) : null}
        </>
      )}
      <Text variant="caption" color="textSecondary">
        Lines combine only when the ingredient and unit match. Ticks work offline.
      </Text>
      <ConfirmDialog
        visible={confirmNew}
        title="Replace this list?"
        message="A new list is created from your plan and this one is archived (not deleted)."
        confirmLabel="Rebuild"
        onCancel={() => setConfirmNew(false)}
        onConfirm={() => void generate()}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: TOUCH_TARGET + 8,
    padding: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.card,
  },
  flex: { flex: 1 },
  done: { textDecorationLine: 'line-through' },
});

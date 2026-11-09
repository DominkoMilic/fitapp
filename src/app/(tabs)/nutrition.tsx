import { router } from 'expo-router';
import { Droplet, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Banner, ConfirmDialog, ErrorState, LoadingState, useToast } from '@/components/feedback';
import {
  Button,
  Card,
  ListItem,
  ProgressBar,
  Screen,
  SectionHeader,
  Text,
  TextField,
  Toggle,
} from '@/components/ui';
import { addDays } from '@/domain/calculations/dates';
import {
  MEAL_LABELS,
  MEAL_TYPES,
  type MealType,
  waterNeedsConfirm,
} from '@/domain/nutrition/totals';
import { useToday } from '@/features/dashboard/useToday';
import { useDayLog, useNutritionActions } from '@/features/nutrition/api';
import { useNutritionDay } from '@/features/nutrition/useNutritionDay';
import { dayLabel } from '@/features/training/labels';
import { spacing, useTheme } from '@/theme';

const fmt = (v: number) => String(Math.round(v));

export default function Nutrition() {
  const { colors } = useTheme();
  const { today } = useToday();
  const [date, setDate] = useState(today);
  const day = useNutritionDay(date);
  const yesterday = useDayLog(addDays(date, -1));
  const actions = useNutritionActions();
  const showToast = useToast((s) => s.show);
  const [confirmWater, setConfirmWater] = useState<number | null>(null);
  const [saveMeal, setSaveMeal] = useState<MealType | null>(null);
  const [mealName, setMealName] = useState('');

  if (day.isPending)
    return (
      <Screen edges={['top']}>
        <LoadingState />
      </Screen>
    );
  if (day.log.isError && !day.log.rows.length) {
    return (
      <Screen edges={['top']}>
        <ErrorState
          message="We couldn't load your food log."
          onRetry={() => void day.log.refetch()}
        />
      </Screen>
    );
  }
  const t = day.target;
  const remaining = t ? t.kcal - day.totals.kcal : null;

  const addWater = async (ml: number) => {
    const id = await actions.addWater(date, ml);
    showToast(`${ml} ml water added`, {
      label: 'Undo',
      onPress: () => void actions.removeWater(id, false),
    });
  };
  const requestWater = (ml: number) =>
    waterNeedsConfirm(ml, day.waterMl) ? setConfirmWater(ml) : void addWater(ml);

  return (
    <Screen edges={['top']}>
      <View style={styles.dateRow}>
        <Button
          title="‹"
          variant="ghost"
          fullWidth={false}
          accessibilityLabel="Previous day"
          onPress={() => setDate(addDays(date, -1))}
        />
        <Text variant="title">{dayLabel(date, today)}</Text>
        <Button
          title="›"
          variant="ghost"
          fullWidth={false}
          accessibilityLabel="Next day"
          disabled={date >= today}
          onPress={() => setDate(addDays(date, 1))}
        />
      </View>

      <Card>
        <Text variant="small" color="textSecondary">
          {remaining === null ? 'Eaten' : remaining >= 0 ? 'Remaining' : 'Over target'}
        </Text>
        <Text variant="display" numeric>
          {remaining === null ? fmt(day.totals.kcal) : fmt(Math.abs(remaining))}{' '}
          <Text variant="small" color="textSecondary">
            kcal
          </Text>
        </Text>
        {t ? (
          <>
            <ProgressBar
              label="Calories"
              value={day.hasData ? day.totals.kcal : null}
              max={t.kcal}
              unit="kcal"
            />
            <ProgressBar
              label="Protein"
              value={day.hasData ? day.totals.protein_g : null}
              max={t.protein_g}
              unit="g"
            />
            <ProgressBar
              label="Carbs"
              value={day.hasData ? day.totals.carbs_g : null}
              max={t.carbs_g}
              unit="g"
            />
            <ProgressBar
              label="Fat"
              value={day.hasData ? day.totals.fat_g : null}
              max={t.fat_g}
              unit="g"
            />
            {t.fibre_g ? (
              <ProgressBar
                label="Fibre"
                value={day.hasData ? day.totals.fibre_g : null}
                max={t.fibre_g}
                unit="g"
              />
            ) : null}
          </>
        ) : null}
        {day.totals.partialItems ? (
          <Text variant="caption" color="warning">
            {day.totals.partialItems} item{day.totals.partialItems > 1 ? 's' : ''} without full
            nutrition data: totals may be low.
          </Text>
        ) : null}
      </Card>

      <Card>
        <View style={styles.row}>
          <Droplet size={20} color={colors.info} />
          <Text variant="bodyStrong" style={styles.flex}>
            Water
          </Text>
          <Text variant="small" color="textSecondary" numeric>
            {(day.waterMl / 1000).toFixed(2)} / {((t?.water_ml ?? 0) / 1000).toFixed(1)} L
          </Text>
        </View>
        <View style={styles.row}>
          {[250, 500].map((ml) => (
            <Button
              key={ml}
              title={`+${ml} ml`}
              variant="secondary"
              fullWidth={false}
              onPress={() => requestWater(ml)}
            />
          ))}
        </View>
      </Card>

      {MEAL_TYPES.map((meal) => {
        const items = day.byMeal[meal];
        const yItems = yesterday.rows.filter((r) => r.meal_type === meal);
        return (
          <View key={meal} style={styles.meal}>
            <SectionHeader
              title={`${MEAL_LABELS[meal]}${items.length ? ` · ${fmt(day.mealTotals[meal].kcal)} kcal` : ''}`}
              action={
                <Button
                  title="Add"
                  variant="ghost"
                  fullWidth={false}
                  icon={<Plus size={16} color={colors.accent} />}
                  onPress={() =>
                    router.push({ pathname: '/nutrition/add', params: { date, meal } })
                  }
                />
              }
            />
            {items.map((it) => (
              <ListItem
                key={it.id}
                title={it.name_snapshot}
                subtitle={[
                  it.quantity !== null && it.unit ? `${Number(it.quantity)} ${it.unit}` : null,
                  it.protein_g !== null ? `P ${fmt(Number(it.protein_g))} g` : null,
                  it.kcal === null || it.protein_g === null ? 'partial data' : null,
                  it._pending ? 'not synced yet' : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
                value={it.kcal === null ? '—' : `${fmt(Number(it.kcal))} kcal`}
                onPress={() =>
                  router.push({ pathname: '/nutrition/item/[id]', params: { id: it.id, date } })
                }
              />
            ))}
            {!items.length && yItems.length ? (
              <Button
                title={`Repeat yesterday's ${MEAL_LABELS[meal].toLowerCase()} (${yItems.length} item${yItems.length > 1 ? 's' : ''})`}
                variant="ghost"
                fullWidth={false}
                onPress={() =>
                  void actions
                    .copyItems(yItems, date, meal)
                    .then(() => showToast('Copied from yesterday'))
                }
              />
            ) : null}
            {items.length ? (
              <Button
                title="Save as a meal"
                variant="ghost"
                fullWidth={false}
                onPress={() => {
                  setMealName('');
                  setSaveMeal(meal);
                }}
              />
            ) : null}
          </View>
        );
      })}

      <Toggle
        label="Day complete"
        description="Turn on when you've logged everything you ate today. PACE only uses complete days to check your calorie target."
        value={day.status.complete}
        onChange={(v) => void actions.setDayComplete(date, v, day.status.serverKeys.has(date))}
      />
      {!day.hasData && date < today ? (
        <Banner
          tone="info"
          message="Nothing logged for this day. That's shown as no data, not zero."
        />
      ) : null}

      <SectionHeader title="More" />
      <ListItem
        title="Saved meals"
        onPress={() => router.push({ pathname: '/nutrition/saved-meals', params: { date } })}
      />
      <ListItem
        title="Recipes"
        subtitle="Browse, save and build your own"
        onPress={() => router.push('/nutrition/recipes')}
      />
      <ListItem
        title="Meal planner"
        subtitle="Plan the week, mark meals eaten"
        onPress={() => router.push('/nutrition/planner')}
      />
      <ListItem title="Shopping list" onPress={() => router.push('/nutrition/shopping')} />

      <ConfirmDialog
        visible={confirmWater !== null}
        title="That's a lot of water"
        message="Drinking very large amounts quickly can be harmful. Add it anyway?"
        confirmLabel="Add"
        onCancel={() => setConfirmWater(null)}
        onConfirm={() => {
          if (confirmWater) void addWater(confirmWater);
          setConfirmWater(null);
        }}
      />
      {saveMeal ? (
        <Card raised>
          <TextField
            label={`Name this ${MEAL_LABELS[saveMeal].toLowerCase()}`}
            value={mealName}
            onChangeText={setMealName}
            maxLength={80}
            autoFocus
          />
          <Button
            title="Save meal"
            disabled={!mealName.trim()}
            onPress={() =>
              void actions.saveMeal(mealName, saveMeal, day.byMeal[saveMeal]).then(() => {
                setSaveMeal(null);
                showToast('Meal saved');
              })
            }
          />
          <Button title="Cancel" variant="ghost" onPress={() => setSaveMeal(null)} />
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  dateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  flex: { flex: 1 },
  meal: { gap: spacing.xxs },
});

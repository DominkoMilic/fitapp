import { useMemo, useState } from 'react';

import { Banner, ErrorState, LoadingState } from '@/components/feedback';
import { Button, Card, NumberField, Screen, SectionHeader, StatTile, Text } from '@/components/ui';
import { type ActivityLevel, type CalcSex } from '@/domain/calculations/energy';
import { calculateNutritionPlan } from '@/domain/calculations/plan';
import {
  checkEditedCalories,
  type GoalType,
  targetsFromEditedCalories,
} from '@/domain/calculations/targets';
import { formatWeight, type UnitSystem } from '@/domain/calculations/units';
import { targetFor } from '@/features/dashboard/today';
import { useToday } from '@/features/dashboard/useToday';
import {
  useActiveGoal,
  useProfile,
  useSaveTargets,
  useTargetHistory,
} from '@/features/profile/api';
import { SaveState } from '@/features/profile/SaveState';

export default function TargetsSettings() {
  const { today } = useToday();
  const profile = useProfile();
  const goal = useActiveGoal();
  const history = useTargetHistory();
  const save = useSaveTargets();
  const [editKcal, setEditKcal] = useState<number | null>(null);
  const [showRecalc, setShowRecalc] = useState(false);

  const recalculated = useMemo(() => {
    const p = profile.data;
    const g = goal.data;
    if (!p || !g || !p.date_of_birth || !p.calc_sex || !p.height_cm || !p.activity_level)
      return null;
    return calculateNutritionPlan({
      sex: p.calc_sex as CalcSex,
      dateOfBirth: p.date_of_birth,
      heightCm: Number(p.height_cm),
      // Weight logging arrives in Phase 2; until then the goal's starting weight is used.
      weightKg: Number(g.starting_weight_kg),
      activityLevel: p.activity_level as ActivityLevel,
      goalType: g.goal_type as GoalType,
      targetWeightKg: g.target_weight_kg === null ? null : Number(g.target_weight_kg),
      weeklyRatePct: g.weekly_rate_pct === null ? null : Number(g.weekly_rate_pct),
      asOf: today,
    });
  }, [profile.data, goal.data, today]);

  if (profile.isPending || goal.isPending || history.isPending)
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  if (profile.isError || goal.isError || history.isError) {
    return (
      <Screen>
        <ErrorState
          message="We couldn't load your targets."
          onRetry={() => void history.refetch()}
        />
      </Screen>
    );
  }

  const current = targetFor(history.data ?? [], today);
  const unit = (profile.data?.unit_system ?? 'metric') as UnitSystem;
  const floor = current?.floor_kcal ?? recalculated?.calories.floorKcal ?? 1200;
  const editCheck = editKcal === null ? null : checkEditedCalories(editKcal, floor);

  const saveVersion = (values: {
    kcal: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    fibre_g: number | null;
    edited: boolean;
  }) => {
    if (!recalculated) return;
    save.mutate(
      {
        effective_from: today,
        kcal: values.kcal,
        protein_g: values.protein_g,
        carbs_g: values.carbs_g,
        fat_g: values.fat_g,
        fibre_g: values.fibre_g,
        water_ml: recalculated.waterMl,
        bmr: Math.round(recalculated.bmr * 100) / 100,
        tdee: Math.round(recalculated.tdee * 100) / 100,
        floor_kcal: recalculated.calories.floorKcal,
        limited_by_floor: recalculated.calories.limitedByFloor,
        is_user_edited: values.edited,
        calculation_version: recalculated.calculationVersion,
        calculation_inputs: {
          ...recalculated.inputs,
          age: recalculated.age,
          activityMultiplier: recalculated.activityMultiplier,
        },
      },
      {
        onSuccess: () => {
          setEditKcal(null);
          setShowRecalc(false);
        },
      },
    );
  };

  return (
    <Screen edges={['bottom']}>
      <SaveState status={save.status} error={save.error} />
      {goal.data ? (
        <Card>
          <Text variant="small" color="textSecondary">
            Goal
          </Text>
          <Text variant="title">
            {{
              lose_weight: 'Lose weight',
              maintain: 'Maintain weight',
              build_muscle: 'Build muscle',
              general_fitness: 'General fitness',
            }[goal.data.goal_type] ?? goal.data.goal_type}
            {goal.data.target_weight_kg !== null
              ? ` → ${formatWeight(Number(goal.data.target_weight_kg), unit)}`
              : ''}
          </Text>
          {goal.data.weekly_rate_pct !== null ? (
            <Text variant="small" color="textSecondary">
              {Number(goal.data.weekly_rate_pct)}% of body weight per week
            </Text>
          ) : null}
        </Card>
      ) : null}

      <SectionHeader title="Current daily targets" />
      {current ? (
        <>
          <StatTile
            label="Calories"
            value={String(current.kcal)}
            unit="kcal"
            caption={`Since ${current.effective_from}${current.is_user_edited ? ' · edited by you' : ''}`}
          />
          <Card>
            <Text>
              Protein {current.protein_g} g · Carbs {current.carbs_g} g · Fat {current.fat_g} g
            </Text>
            {current.water_ml ? (
              <Text variant="small" color="textSecondary">
                Water {(current.water_ml / 1000).toFixed(1)} L (guideline)
              </Text>
            ) : null}
            {current.bmr && current.tdee ? (
              <Text variant="small" color="textSecondary">
                BMR {Math.round(Number(current.bmr))} kcal · maintenance ≈{' '}
                {Math.round(Number(current.tdee))} kcal · safety minimum {current.floor_kcal} kcal
              </Text>
            ) : null}
          </Card>
        </>
      ) : (
        <Banner tone="info" message="No targets yet." />
      )}

      <SectionHeader title="Change targets" />
      <Text variant="small" color="textSecondary">
        Changes create a new version from today. Earlier days keep the targets that applied then.
      </Text>
      <NumberField
        label="Daily calories"
        suffix="kcal"
        decimal={false}
        precision={0}
        value={editKcal ?? current?.kcal ?? null}
        hint={`Minimum ${floor} kcal. Carbs adjust to match.`}
        onChangeValue={setEditKcal}
        error={
          editCheck && !editCheck.ok
            ? `Can't go below the safety minimum of ${floor} kcal`
            : undefined
        }
      />
      <Button
        title="Save calories"
        variant="secondary"
        disabled={editKcal === null || !current || !editCheck?.ok || editKcal === current.kcal}
        loading={save.isPending}
        onPress={() => {
          if (editKcal === null || !current) return;
          const t = targetsFromEditedCalories({
            kcal: editKcal,
            proteinG: current.protein_g,
            fatG: current.fat_g,
            referenceWeightKg: recalculated?.macros.referenceWeightKg ?? 70,
          });
          saveVersion({
            kcal: t.kcal,
            protein_g: t.proteinG,
            carbs_g: t.carbsG,
            fat_g: t.fatG,
            fibre_g: t.fibreG,
            edited: true,
          });
        }}
      />

      {recalculated ? (
        showRecalc ? (
          <Card raised>
            <Text variant="bodyStrong">Recalculated from your current profile</Text>
            <Text variant="small">
              {recalculated.calories.kcal} kcal · P {recalculated.macros.proteinG} g · C{' '}
              {recalculated.macros.carbsG} g · F {recalculated.macros.fatG} g
            </Text>
            <Text variant="caption" color="textSecondary">
              Uses your starting weight ({formatWeight(recalculated.inputs.weightKg, unit)}) until
              weight logging is available.
            </Text>
            <Button
              title="Use these targets"
              loading={save.isPending}
              onPress={() =>
                saveVersion({
                  kcal: recalculated.calories.kcal,
                  protein_g: recalculated.macros.proteinG,
                  carbs_g: recalculated.macros.carbsG,
                  fat_g: recalculated.macros.fatG,
                  fibre_g: recalculated.macros.fibreG,
                  edited: false,
                })
              }
            />
            <Button
              title="Keep current targets"
              variant="ghost"
              onPress={() => setShowRecalc(false)}
            />
          </Card>
        ) : (
          <Button
            title="Recalculate from my profile"
            variant="ghost"
            onPress={() => setShowRecalc(true)}
          />
        )
      ) : null}

      {history.data && history.data.length > 1 ? (
        <>
          <SectionHeader title="History" />
          {history.data.map((v) => (
            <Text key={v.id} variant="small" color="textSecondary">
              From {v.effective_from}: {v.kcal} kcal{v.is_user_edited ? ' (edited)' : ''}
            </Text>
          ))}
        </>
      ) : null}
    </Screen>
  );
}

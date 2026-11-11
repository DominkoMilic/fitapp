import { useState } from 'react';
import { View } from 'react-native';

import { Banner, ErrorState, LoadingState } from '@/components/feedback';
import { Button, ChipGroup, Screen, SegmentedControl, Text, Toggle } from '@/components/ui';
import { WEEKLY_RATE } from '@/constants/safety';
import type { UnitSystem } from '@/domain/calculations/units';
import { FOCUS_TAGS, goalsSchema, type GoalsValues } from '@/domain/validation/onboarding';
import { useToday } from '@/features/dashboard/useToday';
import { WeightField } from '@/features/onboarding/components/MeasurementFields';
import { OptionCard } from '@/features/onboarding/components/OptionCard';
import { type Goal, useActiveGoal, useChangeGoal, useProfile } from '@/features/profile/api';
import { SaveState } from '@/features/profile/SaveState';
import { useWeightStats } from '@/features/weight/useWeightStats';
import { goBack } from '@/navigation/back';
import { spacing } from '@/theme';

const GOALS: { value: GoalsValues['goalType']; title: string }[] = [
  { value: 'lose_weight', title: 'Lose weight' },
  { value: 'maintain', title: 'Maintain weight' },
  { value: 'build_muscle', title: 'Build muscle' },
  { value: 'general_fitness', title: 'General fitness' },
];
const FOCUS_LABELS: Record<(typeof FOCUS_TAGS)[number], string> = {
  strength: 'Strength',
  sport: 'My sport',
  running: 'Running',
  cardio: 'Cardio fitness',
  mobility: 'Mobility',
};

export default function GoalSettings() {
  const goal = useActiveGoal();
  const stats = useWeightStats('30D');
  if (goal.isPending || stats.weights.isPending)
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  if (goal.isError)
    return (
      <Screen>
        <ErrorState message="We couldn't load your goal." onRetry={() => void goal.refetch()} />
      </Screen>
    );
  return (
    <GoalForm
      goal={goal.data}
      currentKg={stats.current?.kg ?? (goal.data ? Number(goal.data.starting_weight_kg) : 80)}
    />
  );
}

function GoalForm({ goal, currentKg }: { goal: Goal | null; currentKg: number }) {
  const { today } = useToday();
  const { data: profile } = useProfile();
  const change = useChangeGoal();
  const unit = (profile?.unit_system ?? 'metric') as UnitSystem;
  const [v, setV] = useState<GoalsValues>({
    goalType: (goal?.goal_type ?? 'maintain') as GoalsValues['goalType'],
    targetWeightKg: goal?.target_weight_kg != null ? Number(goal.target_weight_kg) : null,
    secondaryTargetWeightKg:
      goal?.secondary_target_weight_kg != null ? Number(goal.secondary_target_weight_kg) : null,
    weeklyRatePct: goal?.weekly_rate_pct != null ? Number(goal.weekly_rate_pct) : null,
    rateWarningAccepted: false,
    targetDate: goal?.target_date ?? null,
    focusTags: (goal?.focus_tags ?? []) as GoalsValues['focusTags'],
    // Sports are edited in Settings → Sports; kept here so the goal schema validates.
    sports: [],
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const save = () => {
    const parsed = goalsSchema({
      weightKg: currentKg,
      heightCm: Number(profile?.height_cm ?? 175),
    }).safeParse(v);
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
      return;
    }
    setErrors({});
    const g = parsed.data;
    const usesTarget = g.goalType === 'lose_weight' || g.goalType === 'build_muscle';
    const fields = {
      goal_type: g.goalType,
      focus_tags: g.focusTags,
      target_weight_kg: usesTarget ? g.targetWeightKg : null,
      secondary_target_weight_kg: g.goalType === 'lose_weight' ? g.secondaryTargetWeightKg : null,
      weekly_rate_pct: usesTarget ? g.weeklyRatePct : null,
      target_date: g.targetDate,
    };
    // Same goal type: edit in place (keeps the starting weight and milestones).
    // New goal type: end the current goal and start a new one from today's weight.
    const onSuccess = () => goBack('/profile');
    if (goal && goal.goal_type === g.goalType)
      change.mutate({ mode: 'update', goalId: goal.id, values: fields }, { onSuccess });
    else
      change.mutate(
        {
          mode: 'replace',
          endCurrentAs: 'abandoned',
          next: {
            ...fields,
            starting_weight_kg: Math.round(currentKg * 100) / 100,
            started_at: today,
          },
        },
        { onSuccess },
      );
  };

  const rates = v.goalType === 'lose_weight' ? [0.25, 0.5, 0.75, 1.0] : [0.1, 0.15, 0.25];
  return (
    <Screen
      locked={change.isPending}
      edges={['bottom']}
      footer={<Button title="Save goal" loading={change.isPending} onPress={save} />}
    >
      <SaveState status={change.status} error={change.error} />
      <View style={{ gap: spacing.xs }} accessibilityRole="radiogroup">
        {GOALS.map((g) => (
          <OptionCard
            key={g.value}
            title={g.title}
            selected={v.goalType === g.value}
            onPress={() =>
              setV({
                ...v,
                goalType: g.value,
                weeklyRatePct:
                  g.value === 'lose_weight'
                    ? WEEKLY_RATE.lose.default
                    : g.value === 'build_muscle'
                      ? WEEKLY_RATE.build.default
                      : null,
              })
            }
          />
        ))}
      </View>
      {v.goalType === 'lose_weight' || v.goalType === 'build_muscle' ? (
        <>
          <WeightField
            label="Target weight"
            unitSystem={unit}
            value={v.targetWeightKg}
            onChange={(targetWeightKg) => setV({ ...v, targetWeightKg })}
            error={errors.targetWeightKg}
          />
          {v.goalType === 'lose_weight' ? (
            <WeightField
              label="Secondary target (optional)"
              unitSystem={unit}
              value={v.secondaryTargetWeightKg}
              onChange={(secondaryTargetWeightKg) => setV({ ...v, secondaryTargetWeightKg })}
              error={errors.secondaryTargetWeightKg}
            />
          ) : null}
          <Text variant="small" color="textSecondary">
            Weekly rate (% of body weight)
          </Text>
          <SegmentedControl
            accessibilityLabel="Weekly rate"
            options={rates.map((r) => ({ value: String(r), label: `${r}%` }))}
            value={v.weeklyRatePct === null ? null : String(v.weeklyRatePct)}
            onChange={(r) => setV({ ...v, weeklyRatePct: Number(r) })}
          />
          {errors.weeklyRatePct ? <Text color="danger">{errors.weeklyRatePct}</Text> : null}
          {v.goalType === 'lose_weight' &&
          v.weeklyRatePct !== null &&
          v.weeklyRatePct > WEEKLY_RATE.lose.warnAbove ? (
            <>
              <Banner
                tone="warning"
                message="Faster than recommended. PACE caps the daily deficit at a safe level."
              />
              <Toggle
                label="I understand and want this rate"
                value={v.rateWarningAccepted}
                onChange={(rateWarningAccepted) => setV({ ...v, rateWarningAccepted })}
                error={errors.rateWarningAccepted}
              />
            </>
          ) : null}
        </>
      ) : null}
      <Text variant="small" color="textSecondary">
        Also focus on
      </Text>
      <ChipGroup
        accessibilityLabel="Focus"
        options={FOCUS_TAGS.map((t) => ({ value: t, label: FOCUS_LABELS[t] }))}
        selected={v.focusTags}
        onToggle={(t) =>
          setV({
            ...v,
            focusTags: v.focusTags.includes(t)
              ? v.focusTags.filter((x) => x !== t)
              : [...v.focusTags, t],
          })
        }
      />
    </Screen>
  );
}

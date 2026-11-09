import { Redirect, router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { Banner, LoadingState } from '@/components/feedback';
import {
  Button,
  Card,
  NumberField,
  Screen,
  SectionHeader,
  SegmentedControl,
  StatTile,
  Text,
} from '@/components/ui';
import { envResult } from '@/config/env';
import { calculateNutritionPlan } from '@/domain/calculations/plan';
import { checkEditedCalories, macroKcal } from '@/domain/calculations/targets';
import { formatWeight } from '@/domain/calculations/units';
import { weightMilestones } from '@/domain/milestones/weight-milestones';
import { generateWeeklyPattern } from '@/domain/training/weekly-pattern';
import { onboardingErrorMessage, useCompleteOnboarding } from '@/features/onboarding/api';
import { WEEKDAY_NAMES } from '@/features/onboarding/constants';
import { OnboardingStep } from '@/features/onboarding/components/OnboardingStep';
import {
  emptyDraft,
  type TargetOverrides,
  useOnboardingDraft,
} from '@/features/onboarding/draft-store';
import {
  buildOnboardingPayload,
  finalTargets,
  TargetBelowFloorError,
} from '@/features/onboarding/payload';
import { useAsOf } from '@/features/onboarding/useOnboardingContext';
import { spacing } from '@/theme';

const monthYear = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

export default function PlanStep() {
  const asOf = useAsOf();
  const draft = useOnboardingDraft();
  const complete = useCompleteOnboarding();
  const [editMode, setEditMode] = useState<'none' | 'calories' | 'macros'>('none');
  const [error, setError] = useState<string | null>(null);
  // Set once the server has saved the plan, so clearing the draft can't trigger the
  // "missing answers" redirect below before navigation to Home completes.
  const [saved, setSaved] = useState(false);

  const { personal, goals, activity, equipment, schedule, nutrition, health, consent } = draft;
  const ready =
    personal && goals && activity && equipment && schedule && nutrition && health && consent;

  const computed = useMemo(() => {
    if (!ready) return null;
    const plan = calculateNutritionPlan({
      sex: personal.calcSex,
      dateOfBirth: personal.dateOfBirth,
      heightCm: personal.heightCm,
      weightKg: personal.weightKg,
      activityLevel: activity.activityLevel,
      goalType: goals.goalType,
      targetWeightKg: goals.targetWeightKg,
      weeklyRatePct: goals.weeklyRatePct,
      asOf,
    });
    const pattern = generateWeeklyPattern({
      trainingDaysPerWeek: schedule.trainingDaysPerWeek,
      preferredDays: schedule.preferredDays,
      maxSessionMinutes: schedule.maxSessionMinutes,
      commitments: schedule.commitments,
      focusTags: goals.focusTags,
      sports: goals.sports,
      injuries: health.injuries.map((i) => ({ bodyArea: i.bodyArea, status: i.status })),
    });
    return { plan, pattern };
  }, [ready, personal, goals, activity, schedule, health, asOf]);

  if (saved) {
    return (
      <Screen>
        <LoadingState label="Opening your plan" />
      </Screen>
    );
  }

  if (!ready || !computed) {
    const missing = (
      [
        'personal',
        'goals',
        'activity',
        'equipment',
        'schedule',
        'nutrition',
        'health',
        'consent',
      ] as const
    ).find((k) => !draft[k]);
    return <Redirect href={`/onboarding/${missing ?? 'personal'}`} />;
  }

  const { plan, pattern } = computed;
  const overrides: TargetOverrides = draft.overrides ?? {
    kcal: null,
    proteinG: null,
    carbsG: null,
    fatG: null,
  };
  const targets = finalTargets(plan, draft.overrides);
  const floorCheck = checkEditedCalories(targets.kcal, plan.calories.floorKcal);
  const unit = personal.unitSystem;
  const milestones =
    goals.goalType === 'lose_weight' && goals.targetWeightKg !== null
      ? weightMilestones({
          startKg: personal.weightKg,
          targetKg: goals.targetWeightKg,
          secondaryTargetKg: goals.secondaryTargetWeightKg,
        })
      : [];

  const setOverrides = (next: TargetOverrides | null) => draft.save('overrides', next);

  const onConfirm = () => {
    setError(null);
    try {
      const payload = buildOnboardingPayload({
        draft: {
          personal,
          goals,
          activity,
          equipment,
          schedule,
          nutrition,
          health,
          consent,
          overrides: draft.overrides,
        },
        plan,
        pattern,
        legalVersion: envResult.ok ? envResult.env.legalVersion : 'unknown',
      });
      complete.mutate(payload, {
        onSuccess: () => {
          setSaved(true);
          useOnboardingDraft.setState({ ...emptyDraft, userId: draft.userId });
          router.replace('/');
        },
        onError: (e) => setError(onboardingErrorMessage(e)),
      });
    } catch (e) {
      setError(
        e instanceof TargetBelowFloorError ? e.message : 'Check your targets and try again.',
      );
    }
  };

  return (
    <OnboardingStep
      step="plan"
      title="Your starting plan"
      subtitle="Estimates to start from. PACE refines them from your real weight trend after 3 weeks."
      continueLabel="Save and start"
      loading={complete.isPending}
      onContinue={onConfirm}
    >
      {error ? <Banner tone="danger" message={error} /> : null}

      {/* Without food tracking the targets are still saved, just not shown (spec 6.5). */}
      {nutrition?.trackNutrition !== false ? (
        <>
          <SectionHeader title="Daily targets" />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
            <StatTile
              label="Calories"
              value={String(targets.kcal)}
              unit="kcal"
              caption={targets.edited ? 'Edited by you' : undefined}
            />
            <StatTile label="Protein" value={String(targets.proteinG)} unit="g" />
            <StatTile label="Carbs" value={String(targets.carbsG)} unit="g" />
            <StatTile label="Fat" value={String(targets.fatG)} unit="g" />
            <StatTile
              label="Water"
              value={(plan.waterMl / 1000).toFixed(1)}
              unit="L"
              caption="General guideline"
            />
          </View>
          {plan.calories.limitedByFloor ? (
            <Banner
              tone="info"
              message={`Your target is limited by the safety minimum of ${plan.calories.floorKcal} kcal.`}
            />
          ) : null}
          {plan.calories.deficitCapped ? (
            <Banner
              tone="info"
              message="Your chosen rate needed a larger deficit than PACE allows, so the daily deficit was capped."
            />
          ) : null}
          {targets.warnings.includes('low_carbs') ? (
            <Banner
              tone="warning"
              message="Carbohydrates are below 50 g. Consider less fat so you have energy for training."
            />
          ) : null}
          {targets.warnings.includes('high_protein') ? (
            <Banner
              tone="warning"
              message="Protein is above 2.5 g per kg of reference weight, more than you need."
            />
          ) : null}
          {!floorCheck.ok ? (
            <Banner
              tone="danger"
              message={`Calories can't go below the safety minimum of ${floorCheck.floorKcal} kcal.`}
            />
          ) : null}

          <SegmentedControl
            accessibilityLabel="Edit targets"
            options={[
              { value: 'none', label: 'Suggested' },
              { value: 'calories', label: 'Edit calories' },
              { value: 'macros', label: 'Edit macros' },
            ]}
            value={editMode}
            onChange={(m) => {
              setEditMode(m);
              if (m === 'none') setOverrides(null);
            }}
          />
          {editMode === 'calories' ? (
            <NumberField
              label="Daily calories"
              suffix="kcal"
              decimal={false}
              precision={0}
              value={overrides.kcal ?? targets.kcal}
              hint={`Minimum ${plan.calories.floorKcal} kcal. Carbs adjust to match.`}
              onChangeValue={(kcal) =>
                setOverrides({ kcal, proteinG: null, carbsG: null, fatG: null })
              }
            />
          ) : null}
          {editMode === 'macros' ? (
            <>
              {(['proteinG', 'carbsG', 'fatG'] as const).map((k) => (
                <NumberField
                  key={k}
                  label={{ proteinG: 'Protein', carbsG: 'Carbohydrates', fatG: 'Fat' }[k]}
                  suffix="g"
                  decimal={false}
                  precision={0}
                  value={overrides[k] ?? targets[k]}
                  onChangeValue={(v) =>
                    setOverrides({
                      kcal: null,
                      proteinG: overrides.proteinG ?? targets.proteinG,
                      carbsG: overrides.carbsG ?? targets.carbsG,
                      fatG: overrides.fatG ?? targets.fatG,
                      [k]: v ?? 0,
                    })
                  }
                />
              ))}
              <Text variant="small" color="textSecondary">
                Calories from macros: {macroKcal(targets.proteinG, targets.carbsG, targets.fatG)}{' '}
                kcal
              </Text>
            </>
          ) : null}

          <SectionHeader title="How we calculated this" />
          <Card>
            <Text variant="small">
              BMR (Mifflin-St Jeor, age {plan.age}): {Math.round(plan.bmr)} kcal
            </Text>
            <Text variant="small">
              × activity {plan.activityMultiplier} = maintenance ≈ {Math.round(plan.tdee)} kcal
              (estimate)
            </Text>
            {goals.goalType === 'lose_weight' ? (
              <Text variant="small">
                − deficit {Math.round(plan.calories.requestedAdjustment)} kcal →{' '}
                {plan.calories.kcal} kcal (rounded to 10)
              </Text>
            ) : goals.goalType === 'build_muscle' ? (
              <Text variant="small">
                + surplus {Math.round(-plan.calories.requestedAdjustment)} kcal →{' '}
                {plan.calories.kcal} kcal
              </Text>
            ) : null}
            <Text variant="small">Safety minimum: {plan.calories.floorKcal} kcal</Text>
            <Text variant="small">
              Protein 1.8 g × {formatWeight(plan.macros.referenceWeightKg, unit)} reference weight ·
              fat 25% of calories · carbs the rest
            </Text>
            <Text variant="caption" color="textSecondary">
              The activity multiplier already includes your usual exercise, so exercise calories are
              not added on top.
            </Text>
          </Card>
        </>
      ) : null}

      {plan.projection ? (
        <>
          <SectionHeader title="Projection" />
          <Card>
            <Text variant="body">
              At about {plan.projection.expectedRateKgPerWeek.toFixed(2)} kg per week, you could
              reach {formatWeight(goals.targetWeightKg ?? 0, unit)} around{' '}
              {monthYear(plan.projection.dates.earliest)} –{' '}
              {monthYear(plan.projection.dates.latest)}.
            </Text>
            <Text variant="caption" color="textSecondary">
              An estimate, not a promise. Weight changes are not linear.
            </Text>
          </Card>
        </>
      ) : null}

      <SectionHeader title="Your week" />
      {pattern.warnings.includes('sport_while_injured') ? (
        <Banner
          tone="warning"
          message="Your injury isn't marked as cleared for your sport. We recommend clearance from a healthcare professional before games or practices."
        />
      ) : null}
      {pattern.warnings.includes('too_many_hard_days') ? (
        <Banner
          tone="warning"
          message="More than 4 hard days a week. Consider making one of them easier."
        />
      ) : null}
      {pattern.days.map((d) => (
        <Card key={d.weekday}>
          <Text variant="small" color="textSecondary">
            {WEEKDAY_NAMES[d.weekday - 1]}
          </Text>
          <Text variant="bodyStrong">
            {d.title}
            {d.minutes ? ` · ${d.minutes} min` : ''}
          </Text>
          {d.notes.map((n) => (
            <Text key={n} variant="caption" color="textSecondary">
              {n}
            </Text>
          ))}
        </Card>
      ))}

      {milestones.length ? (
        <>
          <SectionHeader title="Milestones ahead" />
          <Card>
            {milestones.slice(0, 6).map((m) => (
              <Text key={m.key} variant="small">
                • {m.title}
              </Text>
            ))}
          </Card>
        </>
      ) : null}

      <Text variant="caption" color="textSecondary">
        You can change every target and preference later in Profile.
      </Text>
      <Button
        title="Change my answers"
        variant="ghost"
        onPress={() => router.replace('/onboarding/personal')}
      />
    </OnboardingStep>
  );
}

import { Redirect, router } from 'expo-router';
import { useMemo, useState } from 'react';

import { Banner, LoadingState } from '@/components/feedback';
import { Button, Card, Screen, SectionHeader, Text } from '@/components/ui';
import { envResult } from '@/config/env';
import { projectGoalDate } from '@/domain/calculations/goal';
import { formatWeight } from '@/domain/calculations/units';
import { weightMilestones } from '@/domain/milestones/weight-milestones';
import { generateWeeklyPattern } from '@/domain/training/weekly-pattern';
import { onboardingErrorMessage, useCompleteOnboarding } from '@/features/onboarding/api';
import { WEEKDAY_NAMES } from '@/features/onboarding/constants';
import { OnboardingStep } from '@/features/onboarding/components/OnboardingStep';
import { emptyDraft, useOnboardingDraft } from '@/features/onboarding/draft-store';
import { buildOnboardingPayload } from '@/features/onboarding/payload';
import { useAsOf } from '@/features/onboarding/useOnboardingContext';
import { formatMonthYear } from '@/domain/format';

const monthYear = (iso: string) => formatMonthYear(iso);

export default function PlanStep() {
  const asOf = useAsOf();
  const draft = useOnboardingDraft();
  const complete = useCompleteOnboarding();
  const [error, setError] = useState<string | null>(null);
  // Set once the server has saved the plan, so clearing the draft can't trigger the
  // "missing answers" redirect below before navigation to Home completes.
  const [saved, setSaved] = useState(false);

  const { personal, goals, activity, equipment, schedule, health, consent } = draft;
  const ready = personal && goals && activity && equipment && schedule && health && consent;

  const computed = useMemo(() => {
    if (!ready) return null;
    const projection =
      goals.goalType === 'lose_weight'
        ? projectGoalDate({
            currentWeightKg: personal.weightKg,
            targetWeightKg: goals.targetWeightKg,
            weeklyRatePct: goals.weeklyRatePct,
            asOf,
          })
        : null;
    const pattern = generateWeeklyPattern({
      trainingDaysPerWeek: schedule.trainingDaysPerWeek,
      preferredDays: schedule.preferredDays,
      maxSessionMinutes: schedule.maxSessionMinutes,
      commitments: schedule.commitments,
      focusTags: goals.focusTags,
      sports: goals.sports,
      injuries: health.injuries.map((i) => ({ bodyArea: i.bodyArea, status: i.status })),
    });
    return { projection, pattern };
  }, [ready, personal, goals, schedule, health, asOf]);

  if (saved) {
    return (
      <Screen>
        <LoadingState label="Opening your plan" />
      </Screen>
    );
  }

  if (!ready || !computed) {
    const missing = (
      ['personal', 'goals', 'activity', 'equipment', 'schedule', 'health', 'consent'] as const
    ).find((k) => !draft[k]);
    return <Redirect href={`/onboarding/${missing ?? 'personal'}`} />;
  }

  const { projection, pattern } = computed;
  const unit = personal.unitSystem;
  const milestones =
    goals.goalType === 'lose_weight' && goals.targetWeightKg !== null
      ? weightMilestones({
          startKg: personal.weightKg,
          targetKg: goals.targetWeightKg,
          secondaryTargetKg: goals.secondaryTargetWeightKg,
        })
      : [];

  const onConfirm = () => {
    setError(null);
    const payload = buildOnboardingPayload({
      draft: { personal, goals, activity, equipment, schedule, health, consent },
      pattern,
      legalVersion: envResult.ok ? envResult.env.legalVersion : 'unknown',
      asOf,
    });
    complete.mutate(payload, {
      onSuccess: () => {
        setSaved(true);
        useOnboardingDraft.setState({ ...emptyDraft, userId: draft.userId });
        router.replace('/');
      },
      onError: (e) => setError(onboardingErrorMessage(e)),
    });
  };

  return (
    <OnboardingStep
      step="plan"
      title="Your starting plan"
      subtitle="Your week to start from. You can change it any time in Training."
      continueLabel="Save and start"
      loading={complete.isPending}
      onContinue={onConfirm}
    >
      {error ? <Banner tone="danger" message={error} /> : null}

      {projection ? (
        <>
          <SectionHeader title="Your goal" />
          <Card>
            <Text variant="body">
              At about {formatWeight(projection.expectedRateKgPerWeek, unit)} per week, you could
              reach {formatWeight(goals.targetWeightKg ?? 0, unit)} around{' '}
              {monthYear(projection.dates.earliest)} – {monthYear(projection.dates.latest)}.
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
        You can change your goal and preferences later in Profile.
      </Text>
      <Button
        title="Change my answers"
        variant="ghost"
        onPress={() => router.replace('/onboarding/personal')}
      />
    </OnboardingStep>
  );
}

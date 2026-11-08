import { weightMilestones } from '@/domain/milestones/weight-milestones';
import { finalTargets, TargetBelowFloorError } from '@/features/onboarding/payload';
import { nextStep, ONBOARDING_STEPS, previousStep } from '@/features/onboarding/steps';

import { buildSeed, seedDraft } from '../fixtures/onboarding';

describe('onboarding payload (profile creation)', () => {
  it('matches the seed targets and the RPC contract', () => {
    const { payload } = buildSeed();
    expect(payload.targets).toMatchObject({
      kcal: 2720,
      protein_g: 162,
      carbs_g: 347,
      fat_g: 76,
      water_ml: 3800,
      floor_kcal: 2140,
    });
    expect(payload.profile).toMatchObject({
      calc_sex: 'male',
      height_cm: 187,
      activity_level: 'moderate',
    });
    expect(payload.goal).toMatchObject({
      goal_type: 'lose_weight',
      target_weight_kg: 90,
      secondary_target_weight_kg: 87,
    });
    expect(payload.recurring_events).toHaveLength(2);
    expect(payload.plan.weekly_pattern).toHaveLength(7);
    expect(payload.consents.map((c) => c.consent_type).sort()).toEqual([
      'health_data',
      'notifications',
      'privacy',
      'terms',
    ]);
    expect(payload.health_conditions[0]?.restriction_tags).toContain('jumping');
  });

  it('omits targets that do not apply to the goal', () => {
    const { payload } = buildSeed({
      ...seedDraft,
      goals: { ...seedDraft.goals, goalType: 'maintain', targetWeightKg: 95, weeklyRatePct: 0.5 },
    });
    expect(payload.goal.target_weight_kg).toBeNull();
    expect(payload.goal.weekly_rate_pct).toBeNull();
    expect(payload.goal.secondary_target_weight_kg).toBeNull();
  });

  it('does not send health consent rows when there is no health data and no consent', () => {
    const { payload } = buildSeed({
      ...seedDraft,
      health: { injuries: [] },
      consent: { ...seedDraft.consent, healthData: false },
    });
    expect(payload.consents.some((c) => c.consent_type === 'health_data')).toBe(false);
    expect(payload.health_conditions).toEqual([]);
  });

  it('applies edited calories (carbs absorb the change)', () => {
    const { plan } = buildSeed();
    const t = finalTargets(plan, { kcal: 2600, proteinG: null, carbsG: null, fatG: null });
    expect(t).toMatchObject({ kcal: 2600, proteinG: 162, fatG: 76, carbsG: 317, edited: true });
  });

  it('applies edited macros (calories derived)', () => {
    const { plan } = buildSeed();
    const t = finalTargets(plan, { kcal: null, proteinG: 180, carbsG: 300, fatG: 80 });
    expect(t.kcal).toBe(180 * 4 + 300 * 4 + 80 * 9);
  });

  it('refuses targets below the safety floor', () => {
    expect(() =>
      buildSeed({
        ...seedDraft,
        overrides: { kcal: 2000, proteinG: null, carbsG: null, fatG: null },
      }),
    ).toThrow(TargetBelowFloorError);
  });
});

describe('onboarding step order', () => {
  it('has 9 steps ending with the plan', () => {
    expect(ONBOARDING_STEPS).toHaveLength(9);
    expect(nextStep('consent')).toBe('plan');
    expect(nextStep('plan')).toBeNull();
    expect(previousStep('personal')).toBeNull();
  });
});

describe('weight milestones', () => {
  it('seed goal 108 → 90 (87)', () => {
    const keys = weightMilestones({ startKg: 108, targetKg: 90, secondaryTargetKg: 87 }).map(
      (m) => m.key,
    );
    expect(keys).toEqual([
      'weight_lost_1',
      'weight_lost_3',
      'weight_lost_5',
      'weight_reached_100',
      'weight_lost_10',
      'weight_reached_95',
      'weight_lost_15',
      'goal_target',
      'weight_lost_20',
      'goal_secondary',
    ]);
  });
  it('never celebrates the same weight twice', () => {
    const ms = weightMilestones({ startKg: 108, targetKg: 90, secondaryTargetKg: 87 });
    expect(new Set(ms.map((m) => m.thresholdKg)).size).toBe(ms.length);
  });
  it('is sorted from heaviest to lightest with unique keys', () => {
    const ms = weightMilestones({ startKg: 120.4, targetKg: 99, secondaryTargetKg: null });
    expect(new Set(ms.map((m) => m.key)).size).toBe(ms.length);
    for (let i = 1; i < ms.length; i++)
      expect(ms[i - 1]!.thresholdKg).toBeGreaterThanOrEqual(ms[i]!.thresholdKg);
  });
  it('no milestones when the target is not below the start', () => {
    expect(weightMilestones({ startKg: 80, targetKg: 85 })).toEqual([]);
  });
});

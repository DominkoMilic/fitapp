import { CALCULATION_VERSION } from '@/constants/safety';
import { calculateNutritionPlan, trainingSummary } from '@/domain/calculations/plan';
import { calorieTarget, sportCarbAdvice } from '@/domain/calculations/targets';

const base = {
  goalType: 'lose_weight' as const,
  tdee: 3000,
  bmr: 1900,
  sex: 'male' as const,
  weightKg: 100,
  weeklyRatePct: 1.0, // wants 1100 kcal/day
};

describe('deficit cap for frequent hard training (8.4, v2.1.0)', () => {
  it('normally caps the deficit at 750 kcal', () => {
    expect(calorieTarget(base)).toMatchObject({ kcal: 2250, frequentTrainingCap: false });
    expect(calorieTarget({ ...base, hardSessionsPerWeek: 3 })).toMatchObject({ kcal: 2250 });
  });
  it('caps it at 500 kcal with 4+ hard sessions a week', () => {
    expect(calorieTarget({ ...base, hardSessionsPerWeek: 4 })).toMatchObject({
      kcal: 2500,
      frequentTrainingCap: true,
      deficitCapped: true,
    });
  });
  it('a small requested deficit is untouched (no cap message)', () => {
    const r = calorieTarget({ ...base, weeklyRatePct: 0.25, hardSessionsPerWeek: 5 }); // 275 kcal
    expect(r).toMatchObject({ kcal: 2730, frequentTrainingCap: false, deficitCapped: false });
  });
  it('the version records the change', () => {
    expect(CALCULATION_VERSION).toBe('2.1.0');
  });
});

describe('sport carbohydrate guidance (8.6)', () => {
  it('flags carbs under 3 g/kg for sport players training 3+ times a week', () => {
    expect(
      sportCarbAdvice({ carbsG: 200, weightKg: 80, playsSport: true, sessionsPerWeek: 4 }),
    ).toEqual({
      low: true,
      suggestedMinG: 240,
    });
  });
  it('stays quiet without a sport, with few sessions, or with enough carbs', () => {
    const a = { carbsG: 200, weightKg: 80, sessionsPerWeek: 4 };
    expect(sportCarbAdvice({ ...a, playsSport: false }).low).toBe(false);
    expect(sportCarbAdvice({ ...a, playsSport: true, sessionsPerWeek: 2 }).low).toBe(false);
    expect(sportCarbAdvice({ ...a, playsSport: true, carbsG: 260 }).low).toBe(false);
  });
});

describe('plan with a training summary', () => {
  const inputs = {
    sex: 'male' as const,
    dateOfBirth: '2003-05-01',
    heightCm: 187,
    weightKg: 108,
    activityLevel: 'moderate' as const,
    goalType: 'lose_weight' as const,
    targetWeightKg: 90,
    weeklyRatePct: 1.0,
    asOf: '2026-11-09',
  };
  it('without one the results are exactly as before (spec 29 vectors unchanged)', () => {
    const p = calculateNutritionPlan(inputs);
    expect(p.calories.frequentTrainingCap).toBe(false);
    expect(p.sportCarbs).toBeNull();
  });
  it('counts games and hard practices from the schedule', () => {
    const t = trainingSummary({
      commitments: [{ intensity: 'hard' }, { intensity: 'hard' }, { intensity: 'moderate' }],
      trainingDaysPerWeek: 3,
      sports: ['basketball'],
    });
    expect(t).toEqual({ hardSessionsPerWeek: 2, sessionsPerWeek: 6, playsSport: true });
    const four = trainingSummary({
      commitments: Array.from({ length: 4 }, () => ({ intensity: 'hard' })),
      trainingDaysPerWeek: 2,
      sports: ['handball'],
    });
    const capped = calculateNutritionPlan({ ...inputs, training: four });
    const normal = calculateNutritionPlan(inputs);
    expect(capped.calories.frequentTrainingCap).toBe(true);
    expect(capped.calories.kcal).toBeGreaterThan(normal.calories.kcal);
    expect(capped.sportCarbs).not.toBeNull();
  });
});

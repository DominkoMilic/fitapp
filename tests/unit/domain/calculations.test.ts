/**
 * Calculation test vectors from spec section 29.2 (C1–C13) and 25.1.
 * These are normative: if one fails, the implementation is wrong, not the test.
 */
import {
  ageOn,
  bmrMifflinStJeor,
  calculateNutritionPlan,
  calorieTarget,
  checkEditedCalories,
  feetInchesToCm,
  kgToLb,
  macroKcal,
  macroTargets,
  projectGoal,
  referenceWeight,
  safetyFloor,
  targetsFromEditedCalories,
  targetsFromEditedMacros,
  tdee,
  toStoredCm,
  waterTarget,
} from '@/domain/calculations';

describe('BMR (Mifflin-St Jeor)', () => {
  it('C1 male 108 kg 187 cm 23 y', () => {
    expect(bmrMifflinStJeor({ sex: 'male', weightKg: 108, heightCm: 187, age: 23 })).toBe(2138.75);
  });
  it('C2 female 65 kg 165 cm 30 y', () => {
    expect(bmrMifflinStJeor({ sex: 'female', weightKg: 65, heightCm: 165, age: 30 })).toBe(1370.25);
  });
  it('C3 male 80 kg 180 cm 40 y', () => {
    expect(bmrMifflinStJeor({ sex: 'male', weightKg: 80, heightCm: 180, age: 40 })).toBe(1730);
  });
});

describe('TDEE', () => {
  it('C4 C1 × moderate = 3315.0625', () => {
    expect(tdee(2138.75, 'moderate')).toBeCloseTo(3315.0625, 6);
  });
});

describe('calorie target and macros', () => {
  it('C5 seed profile: 2720 kcal, 162 P, 76 F, 347 C', () => {
    const plan = calculateNutritionPlan({
      sex: 'male',
      dateOfBirth: '2003-05-01',
      heightCm: 187,
      weightKg: 108,
      activityLevel: 'moderate',
      goalType: 'lose_weight',
      targetWeightKg: 90,
      weeklyRatePct: 0.5,
      asOf: '2026-11-08',
    });
    expect(plan.age).toBe(23);
    expect(plan.bmr).toBe(2138.75);
    expect(plan.calories.kcal).toBe(2720);
    expect(plan.calories.floorKcal).toBe(2140);
    expect(plan.calories.limitedByFloor).toBe(false);
    expect(plan.calories.requestedAdjustment).toBeCloseTo(594, 6);
    expect(plan.calories.projectedRateKgPerWeek).toBeCloseTo(0.541, 3);
    expect(plan.macros.proteinG).toBe(162);
    expect(plan.macros.fatG).toBe(76);
    expect(plan.macros.carbsG).toBe(347);
    expect(macroKcal(162, 347, 76)).toBe(2720);
    expect(plan.macros.warnings).toEqual([]);
    expect(plan.waterMl).toBe(3800);
  });

  it('C6 female light, 0.5%/wk → 1530, floor 1370 not limiting', () => {
    const bmr = 1370.25;
    const r = calorieTarget({
      goalType: 'lose_weight',
      tdee: tdee(bmr, 'light'),
      bmr,
      sex: 'female',
      weightKg: 65,
      weeklyRatePct: 0.5,
    });
    expect(r.kcal).toBe(1530);
    expect(r.floorKcal).toBe(1370);
    expect(r.limitedByFloor).toBe(false);
  });

  it('C7 deficit capped at 25% TDEE then raised to the 1200 floor', () => {
    const bmr = bmrMifflinStJeor({ sex: 'female', weightKg: 50, heightCm: 160, age: 35 });
    expect(bmr).toBe(1164);
    const t = tdee(bmr, 'sedentary');
    expect(t).toBeCloseTo(1396.8, 6);
    const r = calorieTarget({
      goalType: 'lose_weight',
      tdee: t,
      bmr,
      sex: 'female',
      weightKg: 50,
      weeklyRatePct: 1.0,
    });
    expect(r.requestedAdjustment).toBeCloseTo(349.2, 6);
    expect(r.deficitCapped).toBe(true);
    expect(r.floorKcal).toBe(1200);
    expect(r.kcal).toBe(1200);
    expect(r.limitedByFloor).toBe(true);
  });

  it('C8 1.0%/wk is capped at 750 kcal → 2570 kcal, ≈0.68 kg/wk', () => {
    const r = calorieTarget({
      goalType: 'lose_weight',
      tdee: 3315.0625,
      bmr: 2138.75,
      sex: 'male',
      weightKg: 108,
      weeklyRatePct: 1.0,
    });
    expect(r.requestedAdjustment).toBe(750);
    expect(r.deficitCapped).toBe(true);
    expect(r.kcal).toBe(2570);
    expect(r.projectedRateKgPerWeek).toBeCloseTo(0.677, 3);
  });

  it('maintain targets TDEE; build adds at most 300 kcal', () => {
    const base = { tdee: 2500, bmr: 1700, sex: 'male' as const, weightKg: 80 };
    expect(calorieTarget({ ...base, goalType: 'maintain', weeklyRatePct: null }).kcal).toBe(2500);
    expect(calorieTarget({ ...base, goalType: 'build_muscle', weeklyRatePct: 0.25 }).kcal).toBe(
      2720,
    );
    expect(calorieTarget({ ...base, goalType: 'build_muscle', weeklyRatePct: 0.1 }).kcal).toBe(
      2590,
    );
  });

  it('floor = max(sex floor, BMR rounded to 10)', () => {
    expect(safetyFloor('male', 1300)).toBe(1500);
    expect(safetyFloor('male', 2138.75)).toBe(2140);
    expect(safetyFloor('female', 1164)).toBe(1200);
  });
});

describe('macros', () => {
  it('reference weight uses the goal weight when losing', () => {
    expect(
      referenceWeight({
        goalType: 'lose_weight',
        weightKg: 108,
        heightCm: 187,
        targetWeightKg: 90,
      }),
    ).toBe(90);
  });
  it('reference weight uses BMI-25 weight when BMI ≥ 30 and no target', () => {
    expect(
      referenceWeight({ goalType: 'maintain', weightKg: 110, heightCm: 180, targetWeightKg: null }),
    ).toBeCloseTo(81, 6);
  });
  it('macros sum within ±10 kcal of target across many inputs', () => {
    for (let kcal = 1200; kcal <= 4000; kcal += 37) {
      for (const ref of [55, 70, 90, 110]) {
        const m = macroTargets({ kcal, referenceWeightKg: ref });
        expect(Math.abs(macroKcal(m.proteinG, m.carbsG, m.fatG) - kcal)).toBeLessThanOrEqual(10);
      }
    }
  });
  it('warns when carbs fall below 50 g', () => {
    const m = macroTargets({
      kcal: 1200,
      referenceWeightKg: 110,
      proteinGPerKg: 2.2,
      fatPct: 0.35,
    });
    expect(m.warnings).toContain('low_carbs');
  });
  it('editing macros derives calories', () => {
    const m = targetsFromEditedMacros({
      proteinG: 150,
      carbsG: 300,
      fatG: 80,
      referenceWeightKg: 90,
    });
    expect(m.kcal).toBe(150 * 4 + 300 * 4 + 80 * 9);
  });
  it('editing calories adjusts carbs only', () => {
    const m = targetsFromEditedCalories({
      kcal: 2500,
      proteinG: 162,
      fatG: 76,
      referenceWeightKg: 90,
    });
    expect(m.proteinG).toBe(162);
    expect(m.fatG).toBe(76);
    expect(m.carbsG).toBe(Math.floor((2500 - 648 - 684) / 4));
  });
  it('warns on very high protein', () => {
    const m = targetsFromEditedMacros({
      proteinG: 260,
      carbsG: 200,
      fatG: 60,
      referenceWeightKg: 90,
    });
    expect(m.warnings).toContain('high_protein');
  });
  it('blocks manual calorie edits below the floor', () => {
    expect(checkEditedCalories(2100, 2140)).toEqual({
      ok: false,
      reason: 'below_floor',
      floorKcal: 2140,
    });
    expect(checkEditedCalories(2140, 2140)).toEqual({ ok: true });
  });
});

describe('water', () => {
  it('C9 108 kg → 3800 ml', () => expect(waterTarget(108)).toBe(3800));
  it('C10 40 kg → 1500 ml (clamped)', () => expect(waterTarget(40)).toBe(1500));
  it('clamps to 4000 ml', () => expect(waterTarget(150)).toBe(4000));
});

describe('units and age', () => {
  it('C11 6 ft 2 in = 187.96 cm, stored 188.0; 108 kg = 238.1 lb', () => {
    expect(feetInchesToCm(6, 2)).toBeCloseTo(187.96, 6);
    expect(toStoredCm(feetInchesToCm(6, 2))).toBe(188);
    expect(Math.round(kgToLb(108) * 10) / 10).toBe(238.1);
  });
  it('C12 the day before a birthday', () => expect(ageOn('2003-11-09', '2026-11-08')).toBe(22));
  it('C13 Feb 29 birthday counts on Mar 1 in non-leap years', () => {
    expect(ageOn('2000-02-29', '2025-03-01')).toBe(25);
    expect(ageOn('2000-02-29', '2025-02-28')).toBe(24);
    expect(ageOn('2000-02-29', '2024-02-29')).toBe(24);
  });
});

describe('projection', () => {
  it('seed profile: ≈33 weeks, range 27–44 weeks', () => {
    const p = projectGoal({
      currentWeightKg: 108,
      targetWeightKg: 90,
      tdee: 3315.0625,
      targetKcal: 2720,
      asOf: '2026-11-08',
    });
    expect(p).not.toBeNull();
    expect(Math.round(p!.weeks.mid)).toBe(33);
    expect(Math.round(p!.weeks.fast)).toBe(27);
    expect(Math.round(p!.weeks.slow)).toBe(44);
    expect(p!.dates.earliest < p!.dates.latest).toBe(true);
  });
  it('no date when the expected rate is zero or positive', () => {
    expect(
      projectGoal({
        currentWeightKg: 80,
        targetWeightKg: 75,
        tdee: 2500,
        targetKcal: 2500,
        asOf: '2026-11-08',
      }),
    ).toBeNull();
    expect(
      projectGoal({
        currentWeightKg: 80,
        targetWeightKg: 75,
        tdee: 2500,
        targetKcal: 2600,
        asOf: '2026-11-08',
      }),
    ).toBeNull();
  });
  it('no date without a target or when already at target', () => {
    expect(
      projectGoal({
        currentWeightKg: 80,
        targetWeightKg: null,
        tdee: 2500,
        targetKcal: 2000,
        asOf: '2026-11-08',
      }),
    ).toBeNull();
    expect(
      projectGoal({
        currentWeightKg: 80,
        targetWeightKg: 80,
        tdee: 2500,
        targetKcal: 2000,
        asOf: '2026-11-08',
      }),
    ).toBeNull();
  });
});

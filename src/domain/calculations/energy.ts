import { ageOn, type IsoDate } from './dates';

export type CalcSex = 'male' | 'female';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'very' | 'extra';

/** Activity multipliers (spec 8.3). They already include usual exercise. */
export const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  very: 1.725,
  extra: 1.9,
};

export const ACTIVITY_DESCRIPTIONS: Record<ActivityLevel, { title: string; description: string }> =
  {
    sedentary: { title: 'Sedentary', description: 'Desk job, little or no exercise' },
    light: {
      title: 'Lightly active',
      description: 'Light exercise 1–3 days/week or on your feet part of the day',
    },
    moderate: {
      title: 'Moderately active',
      description: 'Moderate exercise or sport 3–5 days/week',
    },
    very: {
      title: 'Very active',
      description: 'Hard exercise 6–7 days/week, or a physical job plus training',
    },
    extra: {
      title: 'Athlete',
      description: 'Training twice daily, or a very physical job plus daily hard training',
    },
  };

/** Mifflin-St Jeor BMR in kcal/day, full precision (spec 8.2). */
export function bmrMifflinStJeor(input: {
  sex: CalcSex;
  weightKg: number;
  heightCm: number;
  age: number;
}): number {
  const base = 10 * input.weightKg + 6.25 * input.heightCm - 5 * input.age;
  return input.sex === 'male' ? base + 5 : base - 161;
}

export function bmrFor(input: {
  sex: CalcSex;
  weightKg: number;
  heightCm: number;
  dateOfBirth: IsoDate;
  asOf: IsoDate;
}): number {
  return bmrMifflinStJeor({ ...input, age: ageOn(input.dateOfBirth, input.asOf) });
}

export const tdee = (bmr: number, level: ActivityLevel): number =>
  bmr * ACTIVITY_MULTIPLIERS[level];

export const bmi = (weightKg: number, heightCm: number): number => weightKg / (heightCm / 100) ** 2;

export const weightAtBmi = (targetBmi: number, heightCm: number): number =>
  targetBmi * (heightCm / 100) ** 2;

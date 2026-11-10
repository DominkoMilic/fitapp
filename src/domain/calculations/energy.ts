export type CalcSex = 'male' | 'female';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'very' | 'extra';

/** Everyday activity, from least to most (asked in onboarding and Personal information). */
export const ACTIVITY_LEVELS: readonly ActivityLevel[] = [
  'sedentary',
  'light',
  'moderate',
  'very',
  'extra',
];

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

export const bmi = (weightKg: number, heightCm: number): number => weightKg / (heightCm / 100) ** 2;

export const weightAtBmi = (targetBmi: number, heightCm: number): number =>
  targetBmi * (heightCm / 100) ** 2;

import type { NutritionValues } from '@/domain/validation/onboarding';

export const WEEKDAYS = [
  { value: '1', label: 'Mon' },
  { value: '2', label: 'Tue' },
  { value: '3', label: 'Wed' },
  { value: '4', label: 'Thu' },
  { value: '5', label: 'Fri' },
  { value: '6', label: 'Sat' },
  { value: '7', label: 'Sun' },
] as const;

export const WEEKDAY_NAMES = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;

export const DEFAULT_NUTRITION: NutritionValues = {
  dietType: 'omnivore',
  allergies: [],
  intolerances: [],
  dislikedFoods: [],
  preferredCuisines: [],
  mealsPerDay: 3,
  cookingTimeMaxMinutes: null,
  householdServings: 1,
};

export const DISCLAIMER =
  'PACE is not a medical device and does not diagnose or treat injuries or medical conditions. Recommendations are general fitness guidance. Stop exercising if you feel pain, dizziness or chest discomfort, and consult a qualified healthcare professional about injuries, medical conditions or before starting a new programme.';

import type { ActivityType } from '@/domain/activity/met';

export const ACTIVITY_LABEL: Record<ActivityType, string> = {
  walk: 'Walk',
  run: 'Run',
  cycle: 'Ride',
  other: 'Activity',
};

export const RECORDABLE_TYPES = [
  { value: 'walk', label: 'Walk' },
  { value: 'run', label: 'Run' },
  { value: 'cycle', label: 'Ride' },
] as const;

export const QUALITY_LABEL = {
  good: 'GPS good',
  fair: 'GPS fair',
  poor: 'GPS poor — distance may be off',
  none: 'No GPS',
} as const;

import { fireEvent, screen } from '@testing-library/react-native';

import WorkoutDetail from '@/app/training/workout/[id]';
import type { ActiveWorkout } from '@/domain/training/active-workout';

import { renderWithTheme } from '../setup/render';

const TODAY = '2026-11-11';
const mockPush = jest.fn();
const mockSkip = jest.fn(() => Promise.resolve());
let mockDate = TODAY;
let mockPrepared: ActiveWorkout | null = null;

jest.mock('expo-router', () => ({
  router: { push: (...a: unknown[]) => mockPush(...a), replace: jest.fn(), back: jest.fn() },
  useLocalSearchParams: () => ({ id: 'w1' }),
}));
jest.mock('@/navigation/back', () => ({ goBack: jest.fn() }));
jest.mock('@/features/dashboard/useToday', () => ({
  useToday: () => ({ today: '2026-11-11', hour: 9, timezone: 'UTC' }),
}));
jest.mock('@/features/auth/AuthProvider', () => ({
  useAuth: () => ({ session: { user: { id: 'u1' } } }),
}));
jest.mock('@/features/training/active-workout-store', () => ({ useActiveWorkout: () => null }));
jest.mock('@/features/training/prepared-workout-store', () => ({
  usePreparedWorkout: () => mockPrepared,
}));
jest.mock('@/features/training/session-api', () => ({ useSessions: () => ({ sessions: [] }) }));
jest.mock('@/features/training/library', () => ({
  useRestrictions: () => ({ restrictedFor: () => false, sports: [], tags: [] }),
}));
jest.mock('@/features/training/useBuiltWorkout', () => ({
  useBuiltWorkout: () => ({
    title: 'Strength A',
    templateSlug: 'strength-a-upper',
    exercises: [
      {
        slug: 'push-up',
        name: 'Push-up',
        phase: 'main',
        sets: 3,
        repsMin: 8,
        repsMax: 12,
        durationS: null,
        unilateral: false,
      },
    ],
    removed: [],
    adjustedForInjury: false,
    tooFewExercises: false,
  }),
}));
jest.mock('@/features/training/schedule-api', () => ({
  useScheduledWorkout: () => ({
    isPending: false,
    workout: {
      id: 'w1',
      title: 'Strength A',
      kind: 'workout',
      category: 'strength',
      intensity: 'moderate',
      status: 'planned',
      scheduled_date: mockDate,
      scheduled_time: null,
      estimated_duration_minutes: 45,
      template_slug: 'strength-a-upper',
      notes: [],
      occurrence_key: 'k',
      recurring_event_id: null,
    },
  }),
  useScheduleActions: () => ({ skip: mockSkip, restore: jest.fn(), removeOneOff: jest.fn() }),
}));

const button = (name: string | RegExp) => screen.getByRole('button', { name });

beforeEach(() => {
  jest.clearAllMocks();
  mockDate = TODAY;
  mockPrepared = null;
});

describe('workout detail before starting', () => {
  it('can be edited, has no Move button, and starts today', async () => {
    await renderWithTheme(<WorkoutDetail />);
    expect(screen.queryByRole('button', { name: 'Move to another day' })).toBeNull();
    await fireEvent.press(button('Edit before starting'));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/training/prepare',
      params: { scheduledId: 'w1' },
    });
    await fireEvent.press(button('Start workout'));
    expect(mockPush).toHaveBeenLastCalledWith({
      pathname: '/training/session',
      params: { scheduledId: 'w1' },
    });
  });

  it('cannot be started or logged before its day', async () => {
    mockDate = '2026-11-12';
    await renderWithTheme(<WorkoutDetail />);
    expect(screen.getByText(/You can start this on Thursday 12 November/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Start workout' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'I already did this' })).toBeNull();
    expect(screen.queryByRole('button', { name: /20-minute version/ })).toBeNull();
    // Planning ahead is still fine.
    expect(button('Edit before starting')).toBeTruthy();
  });

  it('encourages a shorter session before skipping', async () => {
    await renderWithTheme(<WorkoutDetail />);
    await fireEvent.press(button('Skip'));
    // The dialog shows once its window has its final size.
    expect(await screen.findByText(/Even 20 minutes keeps your rhythm going/)).toBeTruthy();
    expect(screen.getByText(/If you’re ill or in pain, resting is the right call/)).toBeTruthy();
    await fireEvent.press(button('Try the 20-minute version'));
    expect(mockSkip).not.toHaveBeenCalled();
    expect(mockPush).toHaveBeenLastCalledWith({
      pathname: '/training/session',
      params: { scheduledId: 'w1', template: 'full-body-20' },
    });

    await fireEvent.press(button('Skip'));
    await fireEvent.press(await screen.findByRole('button', { name: 'Skip anyway' }));
    expect(mockSkip).toHaveBeenCalledTimes(1);
  });

  it('offers the 20-minute version as a length choice, not an extra button', async () => {
    await renderWithTheme(<WorkoutDetail />);
    expect(screen.queryByRole('button', { name: /Short on time/ })).toBeNull();
    await fireEvent.press(screen.getByRole('radio', { name: 'Quick · 20 min' }));
    // The edit applies to the full plan only.
    expect(screen.queryByRole('button', { name: 'Edit before starting' })).toBeNull();
    await fireEvent.press(button('Start 20-min workout'));
    expect(mockPush).toHaveBeenLastCalledWith({
      pathname: '/training/session',
      params: { scheduledId: 'w1', template: 'full-body-20' },
    });
    await fireEvent.press(screen.getByRole('radio', { name: 'Full · 45 min' }));
    await fireEvent.press(button('Start workout'));
    expect(mockPush).toHaveBeenLastCalledWith({
      pathname: '/training/session',
      params: { scheduledId: 'w1' },
    });
  });

  it('shows the edited version', async () => {
    mockPrepared = {
      exercises: [
        {
          slug: 'squat',
          name: 'Goblet squat',
          tracking: 'reps_weight',
          sets: [{ reps: 10 }, { reps: 10 }],
          unilateral: false,
          added: true,
        },
      ],
    } as unknown as ActiveWorkout;
    await renderWithTheme(<WorkoutDetail />);
    expect(screen.getByText('Edited')).toBeTruthy();
    expect(screen.getByText('Goblet squat')).toBeTruthy();
    expect(screen.queryByText('Push-up')).toBeNull();
    expect(button('Edit again')).toBeTruthy();
  });
});

describe('exercise instructions in the list', () => {
  it('tapping an exercise opens its steps, tapping again closes them', async () => {
    await renderWithTheme(<WorkoutDetail />);
    expect(screen.queryByText(/^1\. /)).toBeNull();
    await fireEvent.press(button(/Push-up, 3 × 8–12 reps/));
    expect(screen.getByText(/^1\. /)).toBeTruthy();
    expect(button(/Animation of Push-up/)).toBeTruthy();
    await fireEvent.press(button(/Push-up, 3 × 8–12 reps/));
    expect(screen.queryByText(/^1\. /)).toBeNull();
  });
});

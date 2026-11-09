import { fireEvent, screen } from '@testing-library/react-native';
import { useState } from 'react';

import type { ActiveWorkout } from '@/domain/training/active-workout';
import { EXERCISE_BY_SLUG } from '@/domain/training/catalogue';
import { emptyWorkout } from '@/domain/training/workout-log';
import { WorkoutEditor } from '@/features/training/WorkoutEditor';

import { renderWithTheme } from '../setup/render';

jest.mock('@/features/training/last-performance', () => ({
  useLastSets: () => ({ lastSets: {}, lastRpeBySlug: {} }),
}));
jest.mock('@/features/training/library', () => {
  const { EXERCISES } = jest.requireActual('@/domain/training/catalogue');
  return {
    useLibrary: () => ({ list: EXERCISES.map((e: object) => ({ ...e, custom: false, id: null })) }),
    useRestrictions: () => ({ tags: ['wrist_load'], sports: [] }),
  };
});

let latest: ActiveWorkout | null = null;
function Harness() {
  const [w, setW] = useState<ActiveWorkout>(() => ({
    ...emptyWorkout({ id: 'w', userId: 'u', title: 'Home', startedAt: 0 }),
  }));
  return (
    <WorkoutEditor
      workout={w}
      onChange={(next) => {
        latest = next;
        setW(next);
      }}
      metric
    />
  );
}

it('adds push-ups the plan did not include, ticks a set and removes one', async () => {
  await renderWithTheme(<Harness />);
  expect(screen.getByText('No exercises yet. Add what you did.')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Add an exercise' }));
  await fireEvent.changeText(screen.getByLabelText('Search exercises'), 'push-up');
  // Injury-aware: push-ups load the wrist, which is restricted here.
  expect(screen.getAllByText(/not for your current injury/).length).toBeGreaterThan(0);
  await fireEvent.press(screen.getByText(EXERCISE_BY_SLUG['push-up']!.name));
  expect(latest!.exercises.map((e) => e.slug)).toEqual(['push-up']);
  const sets = latest!.exercises[0]!.sets.length;
  await fireEvent.press(screen.getByRole('button', { name: 'Set 1 mark as done' }));
  expect(latest!.exercises[0]!.sets[0]!.completed).toBe(true);
  await fireEvent.press(screen.getByRole('button', { name: 'Remove set 2' }));
  expect(latest!.exercises[0]!.sets).toHaveLength(sets - 1);
});

import { SignedInStack } from '@/features/progress/StackLayout';

export default function TrainingLayout() {
  return (
    <SignedInStack
      titles={{
        exercises: 'Exercise library',
        'exercise/[slug]': 'Exercise',
        'exercise-new': 'New exercise',
        calendar: 'Calendar',
        'workout/[id]': 'Workout',
        session: 'Workout',
        summary: 'Workout summary',
        history: 'History',
        'history/[id]': 'Workout',
        records: 'Personal records',
        'log-event': 'Log match or practice',
        'add-workout': 'Add workout',
        'series/[id]': 'Recurring session',
      }}
    />
  );
}

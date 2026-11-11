import { SignedInStack } from '@/features/progress/StackLayout';

export default function TrainingLayout() {
  return (
    <SignedInStack
      titles={{
        add: 'Add training',
        exercises: 'Exercise library',
        'exercise/[slug]': 'Exercise',
        'exercise-new': 'New exercise',
        calendar: 'Calendar',
        'workout/[id]': 'Workout',
        prepare: 'Edit workout',
        session: 'Workout',
        summary: 'Workout summary',
        'history/index': 'History',
        'history/[id]': 'Workout',
        records: 'Personal records',
        'log-event': 'Log a game or activity',
        'add-workout': 'Plan a workout',
        'log-workout': 'Log a workout',
        'history/edit': 'Edit workout',
        'series/[id]': 'Recurring session',
      }}
    />
  );
}

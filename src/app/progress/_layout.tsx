import { SignedInStack } from '@/features/progress/StackLayout';

export default function ProgressLayout() {
  return (
    <SignedInStack
      fallback="/progress"
      titles={{ weight: 'Weight', measurements: 'Measurements', milestones: 'Milestones' }}
    />
  );
}

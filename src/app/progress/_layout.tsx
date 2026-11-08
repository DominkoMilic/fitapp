import { SignedInStack } from '@/features/progress/StackLayout';

export default function ProgressLayout() {
  return (
    <SignedInStack
      titles={{ weight: 'Weight', measurements: 'Measurements', milestones: 'Milestones' }}
    />
  );
}

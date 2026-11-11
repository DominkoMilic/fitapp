import { SignedInStack } from '@/features/progress/StackLayout';

export default function ActivityLayout() {
  return (
    <SignedInStack
      fallback="/training"
      titles={{
        index: 'Activities',
        '[id]': 'Activity',
        manual: 'Add activity',
        track: 'Record activity',
        summary: 'Activity summary',
      }}
    />
  );
}

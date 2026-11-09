import { SignedInStack } from '@/features/progress/StackLayout';

export default function ActivityLayout() {
  return <SignedInStack titles={{ track: 'Record activity', summary: 'Activity summary' }} />;
}

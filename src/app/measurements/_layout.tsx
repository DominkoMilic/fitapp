import { SignedInStack } from '@/features/progress/StackLayout';

export default function MeasurementsLayout() {
  return <SignedInStack fallback="/progress" modal titles={{ log: 'Add measurements' }} />;
}

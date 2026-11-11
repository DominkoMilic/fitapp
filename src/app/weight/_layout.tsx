import { SignedInStack } from '@/features/progress/StackLayout';

export default function WeightLayout() {
  return <SignedInStack fallback="/progress" modal titles={{ log: 'Log weight' }} />;
}

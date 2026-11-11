import { SignedInStack } from '@/features/progress/StackLayout';

export default function ReportsLayout() {
  return (
    <SignedInStack
      fallback="/progress"
      titles={{ index: 'Weekly report', '[week]': 'Weekly report' }}
    />
  );
}

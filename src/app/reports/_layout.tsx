import { SignedInStack } from '@/features/progress/StackLayout';

export default function ReportsLayout() {
  return <SignedInStack titles={{ index: 'Weekly report', '[week]': 'Weekly report' }} />;
}

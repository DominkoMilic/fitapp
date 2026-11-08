import { Utensils } from 'lucide-react-native';

import { EmptyState, ErrorState, LoadingState } from '@/components/feedback';
import { Card, ProgressBar, Screen, SectionHeader, Text } from '@/components/ui';
import { targetFor } from '@/features/dashboard/today';
import { useToday } from '@/features/dashboard/useToday';
import { useTargetHistory } from '@/features/profile/api';
import { useTheme } from '@/theme';

export default function Nutrition() {
  const { colors } = useTheme();
  const { today } = useToday();
  const targets = useTargetHistory();
  if (targets.isPending) {
    return (
      <Screen edges={['top']}>
        <LoadingState />
      </Screen>
    );
  }
  if (targets.isError) {
    return (
      <Screen edges={['top']}>
        <ErrorState
          message="We couldn't load your targets."
          onRetry={() => void targets.refetch()}
        />
      </Screen>
    );
  }
  const t = targetFor(targets.data ?? [], today);
  return (
    <Screen edges={['top']}>
      <Text variant="heading" accessibilityRole="header">
        Nutrition
      </Text>
      {t ? (
        <>
          <SectionHeader title="Today's targets" />
          <Card>
            <ProgressBar label="Calories" value={null} max={t.kcal} unit="kcal" />
            <ProgressBar label="Protein" value={null} max={t.protein_g} unit="g" />
            <ProgressBar label="Carbohydrates" value={null} max={t.carbs_g} unit="g" />
            <ProgressBar label="Fat" value={null} max={t.fat_g} unit="g" />
          </Card>
        </>
      ) : null}
      <EmptyState
        icon={<Utensils size={36} color={colors.textSecondary} />}
        title="Food logging is coming"
        message="Logging meals, recipes, the meal planner and shopping lists arrive in a later update. Your targets are already set."
      />
    </Screen>
  );
}

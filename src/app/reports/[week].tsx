import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef } from 'react';

import { EmptyState, ErrorState, LoadingState } from '@/components/feedback';
import { Screen, Text } from '@/components/ui';
import { isValidIsoDate } from '@/domain/calculations/dates';
import type { UnitSystem } from '@/domain/calculations/units';
import { useProfile } from '@/features/profile/api';
import { useFeatures } from '@/features/profile/features';
import { useSaveReportSnapshot, useWeeklyReport } from '@/features/reports/api';
import { WeeklyReportView } from '@/features/reports/WeeklyReportView';

export default function WeekReport() {
  const features = useFeatures();
  const { week } = useLocalSearchParams<{ week: string }>();
  const valid = typeof week === 'string' && isValidIsoDate(week);
  const { report, fromSnapshot, isPending, isError, refetch } = useWeeklyReport(
    valid ? week : '1970-01-05',
  );
  const save = useSaveReportSnapshot();
  const unit = (useProfile().data?.unit_system ?? 'metric') as UnitSystem;
  const saved = useRef(false);

  // A finished week is stored the first time it's viewed, so the report stays as it was.
  useEffect(() => {
    if (!valid || !report || fromSnapshot || report.inProgress || saved.current) return;
    saved.current = true;
    void save(report);
  }, [valid, report, fromSnapshot, save]);

  if (!valid)
    return (
      <Screen edges={['bottom']}>
        <EmptyState title="Report not found" message="That week doesn't exist." />
      </Screen>
    );
  if (isPending)
    return (
      <Screen edges={['bottom']}>
        <LoadingState />
      </Screen>
    );
  if (isError || !report)
    return (
      <Screen edges={['bottom']}>
        <ErrorState message="This report could not be loaded." onRetry={() => void refetch()} />
      </Screen>
    );
  return (
    <Screen edges={['bottom']}>
      <WeeklyReportView report={report} unit={unit} showNutrition={features.nutrition} />
      {fromSnapshot ? (
        <Text variant="caption" color="textSecondary">
          Saved when the week ended. Later edits don’t change it.
        </Text>
      ) : null}
    </Screen>
  );
}

import { router } from 'expo-router';

import { LoadingState } from '@/components/feedback';
import { ListItem, Screen, SectionHeader } from '@/components/ui';
import type { UnitSystem } from '@/domain/calculations/units';
import { addDays } from '@/domain/calculations/dates';
import { useProfile } from '@/features/profile/api';
import { useCachedReports, useWeeklyReport, useWeekStart } from '@/features/reports/api';
import { WeeklyReportView } from '@/features/reports/WeeklyReportView';
import { formatWeekOf } from '@/domain/format';

/** This week (live) and the last 12 weeks. */
export default function Reports() {
  const { current } = useWeekStart();
  const { report, isPending } = useWeeklyReport(current);
  const cached = useCachedReports();
  const unit = (useProfile().data?.unit_system ?? 'metric') as UnitSystem;
  const past = Array.from({ length: 12 }, (_, i) => addDays(current, -7 * (i + 1)));
  const stored = new Set(cached.rows.map((r) => r.week_start));

  return (
    <Screen edges={['bottom']}>
      {isPending || !report ? <LoadingState /> : <WeeklyReportView report={report} unit={unit} />}
      <SectionHeader title="Past weeks" />
      {past.map((w) => (
        <ListItem
          key={w}
          title={formatWeekOf(w)}
          subtitle={stored.has(w) ? 'Saved report' : undefined}
          onPress={() => router.push({ pathname: '/reports/[week]', params: { week: w } })}
        />
      ))}
    </Screen>
  );
}

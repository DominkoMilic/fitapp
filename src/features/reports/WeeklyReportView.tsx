import { StyleSheet, View } from 'react-native';

import { Card, SectionHeader, StatTile, Text } from '@/components/ui';
import { formatWeight, type UnitSystem } from '@/domain/calculations/units';
import type { WeeklyReport } from '@/domain/reports/weekly';
import { spacing } from '@/theme';

const NO_DATA = 'No data';
const km = (v: number | null, unit: UnitSystem) =>
  v === null ? null : unit === 'metric' ? `${v.toFixed(1)} km` : `${(v / 1.609344).toFixed(1)} mi`;

export function WeeklyReportView({ report: r, unit }: { report: WeeklyReport; unit: UnitSystem }) {
  const change = r.weight.changeKg;
  const changeText =
    change === null
      ? NO_DATA
      : `${change > 0 ? '+' : change < 0 ? '−' : '±'}${formatWeight(Math.abs(change), unit)}`;
  const distances = [
    ['Walking', km(r.activities.walkKm, unit)],
    ['Running', km(r.activities.runKm, unit)],
    ['Cycling', km(r.activities.cycleKm, unit)],
  ].filter(([, v]) => v !== null);

  return (
    <View style={styles.stack}>
      <Text variant="small" color={r.inProgress ? 'accent' : 'textSecondary'}>
        {r.weekStart} – {r.weekEnd}
        {r.inProgress ? ' · In progress' : ''}
      </Text>

      <SectionHeader title="Weight" />
      <View style={styles.grid}>
        <StatTile
          label="7-day average"
          value={r.weight.endAvgKg === null ? NO_DATA : formatWeight(r.weight.endAvgKg, unit)}
          caption={
            r.weight.startAvgKg === null
              ? undefined
              : `Start of week ${formatWeight(r.weight.startAvgKg, unit)}`
          }
        />
        <StatTile
          label="Change this week"
          value={changeText}
          caption={`${r.weight.weighIns} weigh-ins`}
        />
      </View>
      {r.weight.trendKgPerWeek !== null ? (
        <Text variant="small" color="textSecondary">
          Trend: {r.weight.trendKgPerWeek <= 0 ? 'losing' : 'gaining'}{' '}
          {formatWeight(Math.abs(r.weight.trendKgPerWeek), unit)} a week (last 3 weeks)
        </Text>
      ) : null}

      <SectionHeader title="Training" />
      <View style={styles.grid}>
        <StatTile
          label="Workouts"
          value={r.training.planned ? `${r.training.completed} of ${r.training.planned}` : NO_DATA}
          caption={
            r.training.completionPct === null ? undefined : `${r.training.completionPct}% done`
          }
        />
        <StatTile
          label="Training time"
          value={r.training.minutes === null ? NO_DATA : `${r.training.minutes}`}
          unit={r.training.minutes === null ? undefined : 'min'}
        />
        <StatTile
          label="Training load"
          value={r.training.load === null ? NO_DATA : String(r.training.load)}
          caption="Effort (RPE) × minutes"
        />
      </View>

      <SectionHeader title="Activities" />
      {r.activities.count === 0 ? (
        <Text color="textSecondary">{NO_DATA}</Text>
      ) : (
        <Card>
          <Text>
            {r.activities.count} {r.activities.count === 1 ? 'activity' : 'activities'}
          </Text>
          {distances.map(([label, v]) => (
            <Text key={label} variant="small" color="textSecondary">
              {label}: {v}
            </Text>
          ))}
        </Card>
      )}

      <SectionHeader title="Nutrition" />
      <View style={styles.grid}>
        <StatTile
          label="Average calories"
          value={r.nutrition.avgKcal === null ? NO_DATA : String(r.nutrition.avgKcal)}
          unit={r.nutrition.avgKcal === null ? undefined : 'kcal'}
          caption={r.nutrition.basedOn}
        />
        <StatTile
          label="Average protein"
          value={
            r.nutrition.avgProteinG === null ? NO_DATA : String(Math.round(r.nutrition.avgProteinG))
          }
          unit={r.nutrition.avgProteinG === null ? undefined : 'g'}
          caption={r.nutrition.basedOn}
        />
        <StatTile
          label="Water"
          value={r.water.avgMl === null ? NO_DATA : String(r.water.avgMl)}
          unit={r.water.avgMl === null ? undefined : 'ml'}
          caption={r.water.avgMl === null ? undefined : `average on ${r.water.days} logged days`}
        />
      </View>

      {r.milestones.length ? (
        <>
          <SectionHeader title="Milestones" />
          {r.milestones.map((m) => (
            <Text key={m}>🏅 {m}</Text>
          ))}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});

import { router } from 'expo-router';
import { CircleCheck, Moon, Trophy } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { Card, Text } from '@/components/ui';
import { spacing, useTheme } from '@/theme';

import { STATUS_LABEL } from './labels';
import type { ScheduledWorkout } from './schedule-api';

export function OccurrenceRow({ w, highlight }: { w: ScheduledWorkout; highlight?: boolean }) {
  const { colors } = useTheme();
  const done = w.status === 'completed';
  const icon = done ? (
    <CircleCheck size={20} color={colors.accent} />
  ) : w.kind === 'commitment' ? (
    <Trophy size={20} color={colors.warning} />
  ) : w.kind === 'rest' ? (
    <Moon size={20} color={colors.textSecondary} />
  ) : null;
  // Rest days have no time or length: no empty second line.
  const meta = [
    w.scheduled_time?.slice(0, 5),
    w.estimated_duration_minutes ? `${w.estimated_duration_minutes} min` : null,
    STATUS_LABEL[w.status] || null,
    w._pending ? 'not synced yet' : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <Card
      onPress={() => router.push({ pathname: '/training/workout/[id]', params: { id: w.id } })}
      accessibilityLabel={`${w.title}${STATUS_LABEL[w.status] ? `, ${STATUS_LABEL[w.status]}` : ''}`}
      tone={done ? 'success' : 'default'}
      affordance="chevron"
      style={highlight ? { borderColor: colors.accent, borderWidth: 2 } : undefined}
    >
      <View style={styles.row}>
        {icon}
        <View style={styles.flex}>
          <Text
            variant="bodyStrong"
            color={w.status === 'skipped' ? 'textSecondary' : 'textPrimary'}
            style={w.status === 'skipped' ? styles.strike : undefined}
          >
            {w.title}
          </Text>
          {meta ? (
            <Text variant="small" color="textSecondary">
              {meta}
            </Text>
          ) : null}
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1, gap: 2 },
  strike: { textDecorationLine: 'line-through' },
});

import { router } from 'expo-router';
import { CircleCheck, Moon, Trophy } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { Card, StatusTag, Text } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { spacing, useTheme } from '@/theme';

import { useActiveWorkout } from './active-workout-store';
import { STATUS_LABEL } from './labels';
import type { ScheduledWorkout } from './schedule-api';

export function OccurrenceRow({ w, highlight }: { w: ScheduledWorkout; highlight?: boolean }) {
  const { colors } = useTheme();
  const active = useActiveWorkout(useAuth().session?.user.id);
  // Started from this occurrence and not finished yet: amber with a tag, and tapping resumes.
  const inProgress = active?.scheduledId === w.id && w.status === 'planned';
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
    inProgress ? 'Tap to resume' : STATUS_LABEL[w.status] || null,
    w._pending ? 'not synced yet' : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <Card
      onPress={() =>
        inProgress
          ? router.push('/training/session')
          : router.push({ pathname: '/training/workout/[id]', params: { id: w.id } })
      }
      accessibilityLabel={`${w.title}${inProgress ? ', in progress' : STATUS_LABEL[w.status] ? `, ${STATUS_LABEL[w.status]}` : ''}`}
      tone={inProgress ? 'warning' : done ? 'success' : 'default'}
      affordance="chevron"
      style={highlight && !inProgress ? { borderColor: colors.accent, borderWidth: 2 } : undefined}
    >
      <View style={styles.row}>
        {icon}
        <View style={styles.flex}>
          {inProgress ? <StatusTag label="In progress" tone="warning" /> : null}
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

import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button, Card, StatusTag, Text } from '@/components/ui';
import { plural } from '@/domain/format';
import { elapsedS } from '@/domain/training/active-workout';
import { formatClock, useNow } from '@/hooks/useNow';
import { useAuth } from '@/features/auth/AuthProvider';
import { spacing } from '@/theme';

import { useActiveWorkout } from './active-workout-store';

/**
 * Shown when a workout was started but not finished (e.g. after leaving the session or closing
 * the app): amber, with an "In progress" tag so it stands apart from planned sessions.
 */
export function ResumeWorkoutCard() {
  const w = useActiveWorkout(useAuth().session?.user.id);
  const now = useNow(1000, !!w && !w.pausedAt);
  if (!w) return null;
  const done = w.exercises.reduce((a, e) => a + e.sets.filter((s) => s.completed).length, 0);
  return (
    <Card tone="warning">
      <View style={styles.top}>
        <StatusTag label={w.pausedAt ? 'Paused' : 'In progress'} tone="warning" />
      </View>
      <Text variant="title">{w.title}</Text>
      <Text variant="small" color="textSecondary">
        {formatClock(elapsedS(w, now))} · {plural(done, 'set')} done
      </Text>
      <Button title="Resume workout" onPress={() => router.push('/training/session')} />
    </Card>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', gap: spacing.xs },
});

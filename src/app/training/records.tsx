import { useMemo } from 'react';

import { EmptyState, LoadingState } from '@/components/feedback';
import { Card, Screen, Text } from '@/components/ui';
import { personalRecords, weekStartOf } from '@/domain/training/records';
import { useProfile } from '@/features/profile/api';
import { useSessions } from '@/features/training/session-api';

export default function Records() {
  const { sessions, sets, isPending } = useSessions();
  const { data: profile } = useProfile();
  const weekStart = profile?.week_start === 7 ? 7 : 1;
  const records = useMemo(() => {
    const dateOf = new Map(sessions.map((s) => [s.id, s.local_date]));
    return personalRecords(
      sets
        .map((x) => ({
          sessionId: x.workout_session_id,
          date: dateOf.get(x.workout_session_id) ?? '',
          exerciseSlug: x.exercise_slug,
          exerciseName: x.exercise_name,
          reps: x.repetitions,
          weightKg: x.weight_kg === null ? null : Number(x.weight_kg),
          durationS: x.duration_seconds,
          completed: x.completed,
        }))
        .filter((x) => x.date),
      sessions.map((s) => ({
        id: s.id,
        date: s.local_date,
        weekStart: weekStartOf(s.local_date, weekStart),
        durationS: s.duration_seconds,
        completion: s.completion_status,
      })),
    );
  }, [sessions, sets, weekStart]);

  if (isPending)
    return (
      <Screen edges={['bottom']}>
        <LoadingState />
      </Screen>
    );
  if (!records.length)
    return (
      <Screen edges={['bottom']}>
        <EmptyState
          title="No records yet"
          message="Finish a few workouts and your bests show up here."
        />
      </Screen>
    );
  const unit = { reps: 'reps', seconds: 's', minutes: 'min', kg: 'kg' } as const;
  return (
    <Screen edges={['bottom']}>
      <Text color="textSecondary">
        Calculated from your history, so deleting a workout updates them.
      </Text>
      {records.map((r) => (
        <Card key={r.key}>
          <Text variant="small" color="textSecondary">
            {r.title}
          </Text>
          <Text variant="display" numeric>
            {r.value} {unit[r.unit]}
          </Text>
          <Text variant="caption" color="textSecondary">
            {r.key === 'week_minutes' ? `Week of ${r.date}` : r.date}
          </Text>
        </Card>
      ))}
    </Screen>
  );
}

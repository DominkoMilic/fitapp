import { useMemo } from 'react';

import { EmptyState, LoadingState } from '@/components/feedback';
import { Card, Screen, Text } from '@/components/ui';
import { formatDistance, formatPace } from '@/domain/activity/geo';
import { activityRecords } from '@/domain/activity/records';
import { personalRecords, weekStartOf } from '@/domain/training/records';
import { useActivities } from '@/features/activity/api';
import { useProfile } from '@/features/profile/api';
import { useSessions } from '@/features/training/session-api';

export default function Records() {
  const { sessions, sets, isPending } = useSessions();
  const { data: profile } = useProfile();
  const activities = useActivities();
  const units = (profile?.unit_system ?? 'metric') as 'metric' | 'imperial';
  const actRecords = useMemo(
    () =>
      activityRecords(
        activities.rows.map((a) => ({
          id: a.id,
          date: a.local_date,
          type: a.activity_type,
          distanceM: a.distance_meters,
          movingS: a.moving_seconds,
          paceSPerKm: a.average_pace_seconds_per_km,
          quality: a.gps_quality,
          source: a.source,
        })),
      ),
    [activities.rows],
  );
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

  if (isPending || activities.isPending)
    return (
      <Screen edges={['bottom']}>
        <LoadingState />
      </Screen>
    );
  if (!records.length && !actRecords.length)
    return (
      <Screen edges={['bottom']}>
        <EmptyState
          title="No records yet"
          message="Finish a few workouts or activities and your bests show up here."
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
      {actRecords.map((r) => (
        <Card key={r.key}>
          <Text variant="small" color="textSecondary">
            {r.title}
          </Text>
          <Text variant="display" numeric>
            {r.unit === 'm'
              ? formatDistance(r.value, units)
              : `${formatPace(r.value, units)} ${units === 'metric' ? '/km' : '/mi'}`}
          </Text>
          <Text variant="caption" color="textSecondary">
            {r.date}
            {r.manual ? ' · entered manually' : ''}
          </Text>
        </Card>
      ))}
    </Screen>
  );
}

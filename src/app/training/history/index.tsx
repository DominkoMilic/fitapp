import { router } from 'expo-router';
import { useMemo } from 'react';

import { EmptyState, ErrorState, LoadingState } from '@/components/feedback';
import { Button, ListItem, ListScreen, Screen } from '@/components/ui';
import { formatDistance } from '@/domain/activity/geo';
import type { ActivityType } from '@/domain/activity/met';
import { KG_PER_LB } from '@/domain/calculations/units';
import { completionLabel, plural } from '@/domain/format';
import { mergeHistory } from '@/domain/training/history';
import { useActivities } from '@/features/activity/api';
import { ACTIVITY_LABEL } from '@/features/activity/labels';
import { useToday } from '@/features/dashboard/useToday';
import { useProfile } from '@/features/profile/api';
import { dayLabel } from '@/features/training/labels';
import { useSessions } from '@/features/training/session-api';
import { formatClock } from '@/hooks/useNow';

/** Everything you did: workouts, games and walks/runs/rides in one list (newest first). */
export default function History() {
  const { today } = useToday();
  const { sessions, sets, isPending, isError, refetch } = useSessions();
  const activities = useActivities();
  const unit = (useProfile().data?.unit_system ?? 'metric') as 'metric' | 'imperial';
  const metric = unit === 'metric';
  // Completed sets per session, counted once (not per row).
  const doneBySession = useMemo(() => {
    const m = new Map<string, number>();
    for (const x of sets)
      if (x.completed) m.set(x.workout_session_id, (m.get(x.workout_session_id) ?? 0) + 1);
    return m;
  }, [sets]);
  const entries = useMemo(
    () => mergeHistory(sessions, activities.rows),
    [sessions, activities.rows],
  );

  if (isPending || activities.isPending)
    return (
      <Screen edges={['bottom']}>
        <LoadingState />
      </Screen>
    );
  if ((isError || activities.isError) && !entries.length)
    return (
      <Screen edges={['bottom']}>
        <ErrorState
          message="We couldn't load your history."
          onRetry={() => {
            void refetch();
            void activities.refetch();
          }}
        />
      </Screen>
    );
  if (!entries.length) {
    return (
      <Screen edges={['bottom']}>
        <EmptyState
          title="Nothing here yet"
          message="Completed workouts, games, walks, runs and rides appear here."
          actionLabel="Go to Training"
          onAction={() => router.replace('/training')}
        />
      </Screen>
    );
  }
  return (
    <ListScreen
      data={entries}
      keyExtractor={(e) => `${e.kind}:${e.id}`}
      header={
        <Button
          title="Month calendar"
          variant="secondary"
          onPress={() => router.push('/training/calendar')}
        />
      }
      renderItem={(e) => {
        if (e.kind === 'activity') {
          const a = e.item;
          return (
            <ListItem
              title={ACTIVITY_LABEL[a.activity_type as ActivityType]}
              subtitle={[
                dayLabel(a.local_date, today),
                a.distance_meters ? formatDistance(a.distance_meters, unit) : null,
                formatClock(a.moving_seconds),
                a.source === 'manual' ? 'manual' : null,
                a._pending ? 'not synced yet' : null,
              ]
                .filter(Boolean)
                .join(' · ')}
              onPress={() => router.push({ pathname: '/activity/[id]', params: { id: a.id } })}
            />
          );
        }
        const s = e.item;
        const done = doneBySession.get(s.id) ?? 0;
        return (
          <ListItem
            title={s.title}
            subtitle={[
              dayLabel(s.local_date, today),
              formatClock(s.duration_seconds),
              done ? plural(done, 'set') : null,
              s.total_volume_kg
                ? `${Math.round(metric ? Number(s.total_volume_kg) : Number(s.total_volume_kg) / KG_PER_LB)} ${metric ? 'kg' : 'lb'} volume`
                : null,
              s.perceived_exertion !== null ? `RPE ${Number(s.perceived_exertion)}` : null,
              s.completion_status !== 'completed' ? completionLabel(s.completion_status) : null,
              s._pending ? 'not synced yet' : null,
            ]
              .filter(Boolean)
              .join(' · ')}
            onPress={() =>
              router.push({ pathname: '/training/history/[id]', params: { id: s.id } })
            }
          />
        );
      }}
    />
  );
}

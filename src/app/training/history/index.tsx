import { router } from 'expo-router';
import { useMemo } from 'react';

import { EmptyState, ErrorState, LoadingState } from '@/components/feedback';
import { ListItem, ListScreen, Screen } from '@/components/ui';
import { formatClock } from '@/hooks/useNow';
import { useToday } from '@/features/dashboard/useToday';
import { dayLabel } from '@/features/training/labels';
import { useSessions } from '@/features/training/session-api';
import { completionLabel, plural } from '@/domain/format';
import { KG_PER_LB } from '@/domain/calculations/units';
import { useProfile } from '@/features/profile/api';

export default function History() {
  const { today } = useToday();
  const { sessions, sets, isPending, isError, refetch } = useSessions();
  const metric = (useProfile().data?.unit_system ?? 'metric') === 'metric';
  // Completed sets per session, counted once (not per row).
  const doneBySession = useMemo(() => {
    const m = new Map<string, number>();
    for (const x of sets)
      if (x.completed) m.set(x.workout_session_id, (m.get(x.workout_session_id) ?? 0) + 1);
    return m;
  }, [sets]);
  if (isPending)
    return (
      <Screen edges={['bottom']}>
        <LoadingState />
      </Screen>
    );
  if (isError && !sessions.length)
    return (
      <Screen edges={['bottom']}>
        <ErrorState message="We couldn't load your history." onRetry={() => void refetch()} />
      </Screen>
    );
  if (!sessions.length) {
    return (
      <Screen edges={['bottom']}>
        <EmptyState
          title="No workouts yet"
          message="Completed workouts, games and activities appear here."
          actionLabel="Go to Training"
          onAction={() => router.replace('/training')}
        />
      </Screen>
    );
  }
  return (
    <ListScreen
      data={sessions}
      keyExtractor={(s) => s.id}
      renderItem={(s) => {
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

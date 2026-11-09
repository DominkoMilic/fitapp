import { router } from 'expo-router';

import { EmptyState, ErrorState, LoadingState } from '@/components/feedback';
import { ListItem, Screen } from '@/components/ui';
import { formatClock } from '@/hooks/useNow';
import { useToday } from '@/features/dashboard/useToday';
import { dayLabel } from '@/features/training/labels';
import { useSessions } from '@/features/training/session-api';

export default function History() {
  const { today } = useToday();
  const { sessions, sets, isPending, isError, refetch } = useSessions();
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
          message="Completed workouts and logged matches appear here."
          actionLabel="Go to Training"
          onAction={() => router.replace('/training')}
        />
      </Screen>
    );
  }
  return (
    <Screen edges={['bottom']}>
      {sessions.map((s) => {
        const done = sets.filter((x) => x.workout_session_id === s.id && x.completed).length;
        return (
          <ListItem
            key={s.id}
            title={s.title}
            subtitle={[
              dayLabel(s.local_date, today),
              formatClock(s.duration_seconds),
              done ? `${done} sets` : null,
              s.total_volume_kg ? `${Math.round(Number(s.total_volume_kg))} kg volume` : null,
              s.perceived_exertion !== null ? `RPE ${Number(s.perceived_exertion)}` : null,
              s.completion_status !== 'completed' ? s.completion_status : null,
              s._pending ? 'not synced yet' : null,
            ]
              .filter(Boolean)
              .join(' · ')}
            onPress={() =>
              router.push({ pathname: '/training/history/[id]', params: { id: s.id } })
            }
          />
        );
      })}
    </Screen>
  );
}

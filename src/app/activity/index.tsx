import { router } from 'expo-router';

import { EmptyState, ErrorState, LoadingState } from '@/components/feedback';
import { Button, ListItem, ListScreen, Screen } from '@/components/ui';
import { formatDistance } from '@/domain/activity/geo';
import type { ActivityType } from '@/domain/activity/met';
import { useActivities } from '@/features/activity/api';
import { ACTIVITY_LABEL } from '@/features/activity/labels';
import { useProfile } from '@/features/profile/api';
import { formatClock } from '@/hooks/useNow';
import { formatDate } from '@/domain/format';

export default function ActivityHistory() {
  const { rows, isPending, isError, refetch } = useActivities();
  const { data: profile } = useProfile();
  const unit = (profile?.unit_system ?? 'metric') as 'metric' | 'imperial';

  if (isPending)
    return (
      <Screen edges={['bottom']}>
        <LoadingState />
      </Screen>
    );
  if (isError && !rows.length)
    return (
      <Screen edges={['bottom']}>
        <ErrorState message="Activities could not be loaded." onRetry={() => void refetch()} />
      </Screen>
    );
  return (
    <ListScreen
      data={rows}
      keyExtractor={(a) => a.id}
      header={
        <>
          <Button title="Record activity" onPress={() => router.push('/activity/track')} />
          <Button
            title="Add manually"
            variant="secondary"
            onPress={() => router.push('/activity/manual')}
          />
        </>
      }
      empty={
        <EmptyState
          title="No activities yet"
          message="Record a walk, run or ride, or add one manually."
        />
      }
      renderItem={(a) => (
        <ListItem
          title={`${ACTIVITY_LABEL[a.activity_type as ActivityType]} · ${formatDate(a.local_date)}`}
          subtitle={[
            a.distance_meters ? formatDistance(a.distance_meters, unit) : null,
            formatClock(a.moving_seconds),
            a.source === 'manual' ? 'Manual' : null,
            a._pending ? 'Not synced yet' : null,
          ]
            .filter(Boolean)
            .join(' · ')}
          onPress={() => router.push({ pathname: '/activity/[id]', params: { id: a.id } })}
        />
      )}
    />
  );
}

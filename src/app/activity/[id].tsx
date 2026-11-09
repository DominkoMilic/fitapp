import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Banner, ConfirmDialog, EmptyState, LoadingState, useToast } from '@/components/feedback';
import { Button, Screen, SegmentedControl, StatTile, Text } from '@/components/ui';
import { formatDistance, formatPace, formatSpeed } from '@/domain/activity/geo';
import type { ActivityType } from '@/domain/activity/met';
import { useActivities, useActivityActions, useRoute } from '@/features/activity/api';
import { ACTIVITY_LABEL, QUALITY_LABEL } from '@/features/activity/labels';
import { RouteMap } from '@/features/activity/RouteMap';
import { backToActivities } from '@/features/activity/navigation';
import { useProfile } from '@/features/profile/api';
import { useWeightStats } from '@/features/weight/useWeightStats';
import { formatClock } from '@/hooks/useNow';
import { spacing } from '@/theme';
import { formatDate } from '@/domain/format';

export default function ActivityDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { rows, isPending } = useActivities();
  const a = rows.find((r) => r.id === id) ?? null;
  const route = useRoute(a);
  const { data: profile } = useProfile();
  const { deleteRoute, remove, changeType } = useActivityActions();
  const { current } = useWeightStats('30D');
  const [newType, setNewType] = useState<ActivityType | null>(null);
  const showToast = useToast((s) => s.show);
  const [confirm, setConfirm] = useState<'route' | 'activity' | null>(null);
  const unit = (profile?.unit_system ?? 'metric') as 'metric' | 'imperial';

  if (isPending)
    return (
      <Screen edges={['bottom']}>
        <LoadingState />
      </Screen>
    );
  if (!a)
    return (
      <Screen edges={['bottom']}>
        <EmptyState
          title="Activity not found"
          message="It may have been deleted."
          actionLabel="Back"
          onAction={() => backToActivities()}
        />
      </Screen>
    );

  const type = a.activity_type as ActivityType;
  const avgSpeed = Number(a.average_speed_mps ?? 0);
  return (
    <Screen edges={['bottom']}>
      <Text variant="heading">{ACTIVITY_LABEL[type]}</Text>
      <Text variant="small" color="textSecondary">
        {formatDate(a.local_date)} ·{' '}
        {a.source === 'manual'
          ? 'Added manually'
          : QUALITY_LABEL[a.gps_quality as keyof typeof QUALITY_LABEL]}
      </Text>
      {a.route_storage_path ? (
        route.isPending ? (
          <LoadingState label="Loading route" />
        ) : route.data ? (
          <RouteMap pieces={route.data.shape} height={240} />
        ) : (
          <Banner tone="warning" message="The route could not be loaded." />
        )
      ) : a._pending && a.source === 'gps' ? (
        <Text variant="small" color="textSecondary">
          The route appears here once it has synced.
        </Text>
      ) : a.route_deleted_at ? (
        <Text variant="small" color="textSecondary">
          Route deleted. Totals are kept.
        </Text>
      ) : null}
      <View style={styles.grid}>
        <StatTile
          label="Distance"
          value={a.distance_meters ? formatDistance(a.distance_meters, unit) : '—'}
        />
        <StatTile label="Moving time" value={formatClock(a.moving_seconds)} />
        {type === 'cycle' ? (
          <StatTile label="Avg speed" value={formatSpeed(avgSpeed, unit)} />
        ) : (
          <StatTile
            label="Avg pace"
            value={formatPace(a.average_pace_seconds_per_km, unit)}
            unit={unit === 'metric' ? '/km' : '/mi'}
          />
        )}
        <StatTile
          label="Calories"
          value={a.calories_estimated === null ? '—' : String(a.calories_estimated)}
          unit="kcal"
          caption="Estimate"
        />
      </View>
      {a.notes ? <Text>{a.notes}</Text> : null}
      {a.route_storage_path ? (
        <Button title="Delete route only" variant="secondary" onPress={() => setConfirm('route')} />
      ) : null}
      <SegmentedControl
        options={[
          { value: 'walk', label: 'Walk' },
          { value: 'run', label: 'Run' },
          { value: 'cycle', label: 'Ride' },
          { value: 'other', label: 'Other' },
        ]}
        value={type}
        onChange={(t) => {
          // Wait for the route so the distance can be recomputed from it.
          if (t !== type && !(a.route_storage_path && route.isPending)) setNewType(t);
        }}
        accessibilityLabel="Change activity type"
      />
      <Button title="Delete activity" variant="ghost" onPress={() => setConfirm('activity')} />
      <ConfirmDialog
        visible={newType !== null}
        title={`Change to ${newType ? ACTIVITY_LABEL[newType].toLowerCase() : ''}?`}
        message={
          a.route_storage_path && route.data?.points
            ? 'Distance, pace and calories are recalculated from your route with the new type’s limits, and records update.'
            : 'Pace and calories are recalculated and records update. The distance stays the same.'
        }
        confirmLabel="Change"
        onCancel={() => setNewType(null)}
        onConfirm={() => {
          const t = newType;
          setNewType(null);
          if (!t) return;
          void changeType(a, t, route.data ?? null, current?.kg ?? null).then(
            () => showToast(`Changed to ${ACTIVITY_LABEL[t].toLowerCase()}`),
            () => showToast('Could not change the type. Try again.'),
          );
        }}
      />
      <ConfirmDialog
        visible={confirm !== null}
        title={confirm === 'route' ? 'Delete the route?' : 'Delete this activity?'}
        message={
          confirm === 'route'
            ? 'The map of where you went is deleted. Distance, time and records are kept.'
            : 'The activity, its route and its stats are deleted. This can’t be undone.'
        }
        confirmLabel="Delete"
        destructive
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          const which = confirm;
          setConfirm(null);
          if (which === 'route') {
            void deleteRoute(a.id).then(() => showToast('Route deleted'));
          } else {
            const hadRoute = !!a.route_storage_path;
            void (hadRoute ? deleteRoute(a.id) : Promise.resolve())
              .then(() => remove(a.id))
              .then(() => {
                showToast('Activity deleted');
                backToActivities();
              });
          }
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
});

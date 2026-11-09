import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Banner, ConfirmDialog, EmptyState, useToast } from '@/components/feedback';
import { Button, Screen, StatTile, Text, TextField } from '@/components/ui';
import { formatDistance, formatPace, formatSpeed } from '@/domain/activity/geo';
import { finishRecording } from '@/domain/activity/recording';
import { localDateInTimezone } from '@/domain/calculations/dates';
import { useActivityActions } from '@/features/activity/api';
import { ACTIVITY_LABEL, QUALITY_LABEL } from '@/features/activity/labels';
import { recorder } from '@/features/activity/recorder';
import { useActiveRecording } from '@/features/activity/recording-store';
import { RouteMap } from '@/features/activity/RouteMap';
import { useLiveRecording } from '@/features/activity/useLiveRecording';
import { useAuth } from '@/features/auth/AuthProvider';
import { useProfile } from '@/features/profile/api';
import { useWeightStats } from '@/features/weight/useWeightStats';
import { formatClock } from '@/hooks/useNow';
import { spacing } from '@/theme';

export default function ActivitySummaryScreen() {
  const userId = useAuth().session?.user.id;
  const meta = useActiveRecording(userId);
  const { recording } = useLiveRecording(meta, 60_000);
  const { data: profile } = useProfile();
  const { current } = useWeightStats('30D');
  const { save } = useActivityActions();
  const showToast = useToast((s) => s.show);
  const [openedAt] = useState(() => Date.now());
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmShort, setConfirmShort] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const unit = (profile?.unit_system ?? 'metric') as 'metric' | 'imperial';

  if (!meta || !recording) {
    return (
      <Screen edges={['bottom']}>
        <EmptyState
          title="No activity in progress"
          message="Record a walk, run or ride from Training."
          actionLabel="Go to Training"
          onAction={() => router.replace('/training')}
        />
      </Screen>
    );
  }

  const s = finishRecording(recording, meta.pausedAt ?? openedAt, current?.kg ?? null);

  const doSave = async () => {
    setSaving(true);
    try {
      await save({
        id: meta.id,
        summary: s,
        track: recording.track,
        localDate: localDateInTimezone(new Date(s.startedAt), profile?.timezone ?? 'UTC'),
        source: 'gps',
        notes: notes.trim() ? notes.trim().slice(0, 1000) : null,
      });
      await recorder.clear();
      showToast(`${ACTIVITY_LABEL[s.type]} saved`);
      router.dismissTo('/training');
    } catch {
      showToast('Could not save. Your recording is kept — try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen edges={['bottom']}>
      <Text variant="heading">{ACTIVITY_LABEL[s.type]}</Text>
      <Text variant="small" color="textSecondary">
        {QUALITY_LABEL[s.quality]} · {s.pointsValid} of {s.pointsTotal} points used
      </Text>
      {s.quality === 'poor' ? (
        <Banner
          tone="warning"
          message="The GPS signal was weak, so this distance won't count towards records or distance milestones."
        />
      ) : null}
      <RouteMap pieces={recording.track.pieces} height={240} />
      <View style={styles.grid}>
        <StatTile label="Distance" value={formatDistance(s.distanceM, unit)} />
        <StatTile label="Moving time" value={formatClock(s.movingS)} />
        {s.type === 'cycle' ? (
          <StatTile label="Avg speed" value={formatSpeed(s.avgSpeedMps, unit)} />
        ) : (
          <StatTile
            label="Avg pace"
            value={formatPace(s.avgPaceSPerKm, unit)}
            unit={unit === 'metric' ? '/km' : '/mi'}
          />
        )}
        <StatTile
          label="Calories"
          value={s.kcal === null ? '—' : String(Math.round(s.kcal))}
          unit="kcal"
          caption={s.kcal === null ? 'Log your weight to estimate' : 'Estimate'}
        />
      </View>
      <Text variant="small" color="textSecondary">
        Total time {formatClock(s.elapsedS)}
      </Text>
      <TextField
        label="Notes (optional)"
        value={notes}
        onChangeText={setNotes}
        maxLength={1000}
        multiline
      />
      <Button
        title="Save"
        loading={saving}
        onPress={() => (s.isShort ? setConfirmShort(true) : void doSave())}
      />
      <Button
        title="Resume recording"
        variant="secondary"
        disabled={saving}
        onPress={() =>
          void recorder.resume().then(
            () => router.replace('/activity/track'),
            () => showToast('Could not restart location updates.'),
          )
        }
      />
      <Button title="Discard" variant="ghost" onPress={() => setConfirmDiscard(true)} />
      <ConfirmDialog
        visible={confirmShort}
        title="Save a very short activity?"
        message="This activity is under 1 minute or 50 m. Save it anyway?"
        confirmLabel="Save"
        onCancel={() => setConfirmShort(false)}
        onConfirm={() => {
          setConfirmShort(false);
          void doSave();
        }}
      />
      <ConfirmDialog
        visible={confirmDiscard}
        title="Discard this activity?"
        message="The recorded route and stats will be deleted. This can't be undone."
        confirmLabel="Discard"
        destructive
        onCancel={() => setConfirmDiscard(false)}
        onConfirm={() => {
          setConfirmDiscard(false);
          void recorder.clear().then(() => router.dismissTo('/training'));
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
});

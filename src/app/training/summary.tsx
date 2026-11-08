import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Banner, ConfirmDialog, EmptyState, useToast } from '@/components/feedback';
import {
  Button,
  ChipGroup,
  Screen,
  SegmentedControl,
  StatTile,
  Text,
  TextField,
} from '@/components/ui';
import { localDateInTimezone } from '@/domain/calculations/dates';
import { setsForSave, summarize } from '@/domain/training/active-workout';
import { EXERCISE_BY_SLUG } from '@/domain/training/catalogue';
import { exerciseId } from '@/domain/training/stable-id';
import { estimateCalories, sessionMet } from '@/domain/training/session';
import { formatClock } from '@/hooks/useNow';
import { useAuth } from '@/features/auth/AuthProvider';
import { useProfile } from '@/features/profile/api';
import { useActiveWorkout, useActiveWorkoutStore } from '@/features/training/active-workout-store';
import { useScheduledWorkout } from '@/features/training/schedule-api';
import { useSaveSession } from '@/features/training/session-api';
import { useWeightStats } from '@/features/weight/useWeightStats';
import { spacing } from '@/theme';

export default function WorkoutSummary() {
  const userId = useAuth().session?.user.id;
  const w = useActiveWorkout(userId);
  const setStore = useActiveWorkoutStore((s) => s.set);
  const { workout: scheduled } = useScheduledWorkout(w?.scheduledId ?? undefined);
  const { data: profile } = useProfile();
  const { current } = useWeightStats('30D');
  const save = useSaveSession();
  const showToast = useToast((s) => s.show);
  const [now] = useState(() => Date.now());
  const [rpe, setRpe] = useState<number | null>(null);
  const [feeling, setFeeling] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [useEstimated, setUseEstimated] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  if (!w) {
    return (
      <Screen edges={['bottom']}>
        <EmptyState
          title="No workout in progress"
          message="Start one from your calendar."
          actionLabel="Go to Training"
          onAction={() => router.replace('/training')}
        />
      </Screen>
    );
  }
  const s = summarize(w, now);
  const durationS = useEstimated ? (scheduled?.estimated_duration_minutes ?? 45) * 60 : s.durationS;
  const kcal = current
    ? estimateCalories(
        sessionMet({ category: w.category, intensity: w.intensity }),
        current.kg,
        durationS,
      )
    : null;

  const onSave = async () => {
    setSaving(true);
    try {
      const endedAt = useEstimated ? w.startedAt + durationS * 1000 + w.pausedMs : now;
      await save({
        scheduled: scheduled ?? null,
        templateSlug: w.templateSlug,
        title: w.title,
        category: w.category,
        startedAt: new Date(w.startedAt).toISOString(),
        endedAt: new Date(endedAt).toISOString(),
        localDate: localDateInTimezone(new Date(w.startedAt), profile?.timezone ?? 'UTC'),
        durationSeconds: durationS,
        pausedSeconds: s.pausedS,
        rpe,
        feeling,
        volumeKg: Math.round(s.volumeKg * 10) / 10,
        calories: kcal,
        completion: s.status,
        source: 'app',
        notes: notes.trim() || null,
        sets: setsForSave(w).map((r) => ({
          ...r,
          // System exercises have deterministic ids; custom ones carry their own uuid.
          exerciseId: r.exerciseSlug.startsWith('custom:')
            ? r.exerciseSlug.slice('custom:'.length)
            : EXERCISE_BY_SLUG[r.exerciseSlug]
              ? exerciseId(r.exerciseSlug)
              : null,
        })),
      });
      setStore(null);
      router.replace('/training');
      showToast(
        s.status === 'abandoned'
          ? 'Workout saved (no sets completed)'
          : 'Workout saved. Nice work!',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen
      edges={['bottom']}
      footer={
        <>
          <Button title="Save workout" loading={saving} onPress={() => void onSave()} />
          <Button title="Back to workout" variant="ghost" onPress={() => router.back()} />
        </>
      }
    >
      <Text variant="heading" accessibilityRole="header">
        {w.title}
      </Text>
      {s.suspiciouslyLong ? (
        <>
          <Banner
            tone="warning"
            message="This workout ran for more than 4 hours. Did you forget to finish it?"
          />
          <SegmentedControl
            accessibilityLabel="Duration to save"
            options={[
              { value: 'actual', label: `Actual ${formatClock(s.durationS)}` },
              {
                value: 'estimated',
                label: `Planned ${scheduled?.estimated_duration_minutes ?? 45} min`,
              },
            ]}
            value={useEstimated ? 'estimated' : 'actual'}
            onChange={(v) => setUseEstimated(v === 'estimated')}
          />
        </>
      ) : null}
      {s.painReported ? (
        <Banner
          tone="warning"
          message="You reported pain. Rest that area and check your injury status in Profile → Health. If it persists, get professional advice."
        />
      ) : null}
      <View style={styles.row}>
        <StatTile label="Duration" value={formatClock(durationS)} />
        <StatTile
          label="Sets done"
          value={`${s.setsDone}`}
          caption={`of ${s.plannedSets} planned`}
        />
      </View>
      <View style={styles.row}>
        <StatTile
          label="Volume"
          value={s.volumeKg ? `${Math.round(s.volumeKg)}` : '—'}
          unit={s.volumeKg ? 'kg' : undefined}
          caption={s.volumeKg ? undefined : 'Bodyweight work'}
        />
        <StatTile label="Calories" value={kcal === null ? '—' : `≈${kcal}`} caption="Estimate" />
      </View>
      {s.status === 'abandoned' ? (
        <Banner
          tone="info"
          message="No sets were marked done. You can save it anyway or go back and mark your sets."
        />
      ) : null}
      <Text variant="small" color="textSecondary">
        How hard was it overall? (RPE 0–10)
      </Text>
      <ChipGroup
        accessibilityLabel="Effort (RPE)"
        options={Array.from({ length: 11 }, (_, n) => ({ value: String(n), label: String(n) }))}
        selected={rpe === null ? [] : [String(rpe)]}
        onToggle={(v) => setRpe(Number(v))}
      />
      <Text variant="small" color="textSecondary">
        How do you feel? (1 = drained, 5 = great)
      </Text>
      <SegmentedControl
        accessibilityLabel="How do you feel"
        options={['1', '2', '3', '4', '5'].map((v) => ({ value: v, label: v }))}
        value={feeling === null ? null : String(feeling)}
        onChange={(v) => setFeeling(Number(v))}
      />
      <TextField
        label="Notes (optional)"
        value={notes}
        onChangeText={setNotes}
        maxLength={1000}
        multiline
      />
      <Button title="Discard workout" variant="ghost" onPress={() => setConfirmDiscard(true)} />
      <ConfirmDialog
        visible={confirmDiscard}
        destructive
        title="Discard this workout?"
        message="Nothing from this session will be saved."
        confirmLabel="Discard"
        onCancel={() => setConfirmDiscard(false)}
        onConfirm={() => {
          setStore(null);
          setConfirmDiscard(false);
          router.replace('/training');
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: 'row', gap: spacing.xs } });

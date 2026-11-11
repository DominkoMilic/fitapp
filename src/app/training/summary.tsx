import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { goBack } from '@/navigation/back';
import { Banner, ConfirmDialog, EmptyState, useToast } from '@/components/feedback';
import { Button, Screen, SegmentedControl, StatTile, Text } from '@/components/ui';
import { localDateInTimezone } from '@/domain/calculations/dates';
import { summarize } from '@/domain/training/active-workout';
import { estimateCalories, sessionMet } from '@/domain/training/session';
import { clockText, type DurationMode, manualTiming } from '@/domain/training/workout-log';
import { formatClock } from '@/hooks/useNow';
import { useAuth } from '@/features/auth/AuthProvider';
import { minuteInTimezone } from '@/features/coach/time';
import { useProfile } from '@/features/profile/api';
import { useActiveWorkout, useActiveWorkoutStore } from '@/features/training/active-workout-store';
import { EffortFields } from '@/features/training/EffortFields';
import { useScheduledWorkout } from '@/features/training/schedule-api';
import { useSaveSession } from '@/features/training/session-api';
import { sessionRecord } from '@/features/training/session-record';
import { TimingFields, type TimingValue } from '@/features/training/TimingFields';
import { useWeightStats } from '@/features/weight/useWeightStats';
import { spacing } from '@/theme';

export default function WorkoutSummary() {
  const userId = useAuth().session?.user.id;
  const w = useActiveWorkout(userId);
  const finish = useActiveWorkoutStore((s) => s.finish);
  const { workout: scheduled } = useScheduledWorkout(w?.scheduledId ?? undefined);
  const { data: profile } = useProfile();
  const { current } = useWeightStats('30D');
  const save = useSaveSession();
  const showToast = useToast((s) => s.show);
  const timezone = profile?.timezone ?? 'UTC';
  const [now] = useState(() => Date.now());
  const [rpe, setRpe] = useState<number | null>(null);
  const [feeling, setFeeling] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [mode, setMode] = useState<DurationMode | null>(null);
  const [custom, setCustom] = useState<TimingValue | null>(null);
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
  const plannedMin = scheduled?.estimated_duration_minutes ?? 45;
  // A timer under 5 minutes or over 4 hours probably isn't the real workout length.
  const doubtful = s.durationS < 5 * 60 || s.suspiciouslyLong;
  const chosen: DurationMode = mode ?? 'timer';
  const today = localDateInTimezone(new Date(now), timezone);
  const customValue: TimingValue = custom ?? {
    date: localDateInTimezone(new Date(w.startedAt), timezone),
    startTime: clockText(minuteInTimezone(new Date(w.startedAt), timezone)),
    durationMinutes: Math.max(1, Math.round(s.durationS / 60)),
  };
  const customTiming =
    chosen === 'custom'
      ? manualTiming({
          date: customValue.date,
          startTime: customValue.startTime,
          durationMinutes: customValue.durationMinutes ?? 0,
          timezone,
          now,
          today,
        })
      : null;
  const timing =
    chosen === 'custom'
      ? customTiming?.ok
        ? { ...customTiming.value, pausedS: 0 }
        : null
      : chosen === 'planned'
        ? {
            startedAt: w.startedAt,
            endedAt: w.startedAt + plannedMin * 60_000,
            durationS: plannedMin * 60,
            pausedS: 0,
          }
        : { startedAt: w.startedAt, endedAt: now, durationS: s.durationS, pausedS: s.pausedS };
  const kcal =
    current && timing
      ? estimateCalories(
          sessionMet({ category: w.category, intensity: w.intensity }),
          current.kg,
          timing.durationS,
        )
      : null;

  const onSave = async () => {
    if (!timing) return;
    setSaving(true);
    try {
      await save(
        sessionRecord({
          workout: w,
          timing,
          scheduled: scheduled ?? null,
          rpe,
          feeling,
          notes,
          weightKg: current?.kg ?? null,
          timezone,
          source: chosen === 'custom' ? 'manual' : 'app',
        }),
      );
      finish();
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
      locked={saving}
      edges={['bottom']}
      footer={
        <>
          <Button
            title="Save workout"
            loading={saving}
            disabled={!timing}
            onPress={() => void onSave()}
          />
          <Button title="Back to workout" variant="ghost" onPress={() => goBack('/training')} />
        </>
      }
    >
      <Text variant="heading" accessibilityRole="header">
        {w.title}
      </Text>
      {s.suspiciouslyLong ? (
        <Banner
          tone="warning"
          message="This workout ran for more than 4 hours. Did you forget to finish it? Choose the duration to save below."
        />
      ) : s.durationS < 5 * 60 ? (
        <Banner
          tone="info"
          message="The timer ran for under 5 minutes. If you trained without the app running, enter the real time below."
        />
      ) : null}
      {s.painReported ? (
        <Banner
          tone="warning"
          message="You reported pain. Rest that area and check your injury status in Profile → Health. If it persists, get professional advice."
        />
      ) : null}

      <Text variant="small" color="textSecondary">
        Duration to save
      </Text>
      <SegmentedControl
        accessibilityLabel="Duration to save"
        options={[
          { value: 'timer', label: `Timer ${formatClock(s.durationS)}` },
          { value: 'planned', label: `Planned ${plannedMin} min` },
          { value: 'custom', label: 'Enter time' },
        ]}
        value={chosen}
        onChange={setMode}
      />
      {chosen === 'custom' ? (
        <TimingFields
          value={customValue}
          onChange={setCustom}
          today={today}
          error={customTiming && !customTiming.ok ? customTiming.error : null}
        />
      ) : doubtful && mode === null ? (
        <Text variant="caption" color="textSecondary">
          Not right? Choose “Enter time” to set when you started and for how long.
        </Text>
      ) : null}

      <View style={styles.row}>
        <StatTile label="Duration" value={timing ? formatClock(timing.durationS) : '—'} />
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
      <EffortFields
        rpe={rpe}
        feeling={feeling}
        notes={notes}
        onRpe={setRpe}
        onFeeling={setFeeling}
        onNotes={setNotes}
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
          finish();
          setConfirmDiscard(false);
          router.replace('/training');
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: 'row', gap: spacing.xs } });

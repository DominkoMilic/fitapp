import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Platform, StyleSheet, View } from 'react-native';

import { Banner, ConfirmDialog, useToast } from '@/components/feedback';
import { Button, Card, Screen, SegmentedControl, StatTile, Text } from '@/components/ui';
import { formatDistance, formatPace, formatSpeed } from '@/domain/activity/geo';
import { gpsQuality } from '@/domain/activity/gps-filter';
import type { ActivityType } from '@/domain/activity/met';
import { canResume, liveStats } from '@/domain/activity/recording';
import { QUALITY_SHORT, RECORDABLE_TYPES } from '@/features/activity/labels';
import { recorder } from '@/features/activity/recorder';
import { useActiveRecording } from '@/features/activity/recording-store';
import { RouteMap } from '@/features/activity/RouteMap';
import { useLiveRecording } from '@/features/activity/useLiveRecording';
import { backToActivities } from '@/features/activity/navigation';
import { useAuth } from '@/features/auth/AuthProvider';
import { useProfile } from '@/features/profile/api';
import { useWeightStats } from '@/features/weight/useWeightStats';
import { formatClock, useNow } from '@/hooks/useNow';
import {
  isApproximateOnly,
  permissionState,
  requestBackground,
  requestForeground,
  watchAccuracy,
} from '@/services/location/tracker';
import { spacing } from '@/theme';
import { announce } from '@/services/a11y/announce';

type Perm = Awaited<ReturnType<typeof permissionState>>;
/** Good enough to start without a warning (spec 11.3: wait for a fix ≤ 25 m). */
const READY_ACCURACY_M = 25;

export default function TrackActivity() {
  const userId = useAuth().session?.user.id;
  const rec = useActiveRecording(userId);
  return rec ? <Live /> : <Setup userId={userId} />;
}

/** Type → permission explainers → GPS fix → start. */
function Setup({ userId }: { userId: string | undefined }) {
  const [type, setType] = useState<ActivityType>('walk');
  const [perm, setPerm] = useState<Perm | null>(null);
  const [skipBackground, setSkipBackground] = useState(false);
  const [approximate, setApproximate] = useState(false);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = () =>
    permissionState().then(setPerm, () => setError('Could not read location permission.'));
  useEffect(() => {
    void refresh();
  }, []);
  useEffect(() => {
    if (!perm?.foreground) return;
    void isApproximateOnly().then(setApproximate, () => undefined);
    let stop: (() => void) | null = null;
    let alive = true;
    watchAccuracy(setAccuracy).then(
      (s) => (alive ? (stop = s) : s()),
      () => setError('Could not get a GPS signal.'),
    );
    return () => {
      alive = false;
      stop?.();
    };
  }, [perm?.foreground]);

  if (!perm) {
    return (
      <Screen edges={['bottom']}>
        <Text color="textSecondary">Checking location access…</Text>
      </Screen>
    );
  }

  if (!perm.foreground) {
    return (
      <Screen edges={['bottom']}>
        <Text variant="heading">Location while recording</Text>
        <Text color="textSecondary">
          PACE uses your location only while you record a walk, run or ride, to measure distance and
          draw your route. Routes are private to you and you can delete them at any time.
        </Text>
        {perm.canAskForeground ? (
          <Button
            title="Continue"
            onPress={() => void requestForeground().then(refresh, refresh)}
          />
        ) : (
          <>
            <Banner
              tone="warning"
              message="Location access is turned off for PACE. Turn it on in Settings to record activities. You can still add an activity manually."
            />
            <Button title="Open Settings" onPress={() => void Linking.openSettings()} />
          </>
        )}
        {perm.canAskForeground ? null : (
          <Button
            title="Add an activity manually"
            variant="secondary"
            onPress={() => router.replace('/activity/manual')}
          />
        )}
      </Screen>
    );
  }

  if (Platform.OS !== 'web' && !perm.background && !skipBackground) {
    return (
      <Screen edges={['bottom']}>
        <Text variant="heading">Keep recording with the screen off</Text>
        <Text color="textSecondary">
          {Platform.OS === 'ios'
            ? 'To keep tracking when your phone is locked, choose "Change to Always Allow" on the next prompt.'
            : 'To keep tracking when your phone is locked, choose "Allow all the time" on the next screen.'}{' '}
          PACE only uses location while a recording is running, and shows a notification while it
          does.
        </Text>
        <Button
          title="Allow background tracking"
          onPress={() =>
            void requestBackground().then(
              (ok) => (ok ? refresh() : setSkipBackground(true)),
              () => setSkipBackground(true),
            )
          }
        />
        <Button
          title="Only while the app is open"
          variant="secondary"
          onPress={() => setSkipBackground(true)}
        />
      </Screen>
    );
  }

  const ready = accuracy !== null && accuracy <= READY_ACCURACY_M;
  const start = async () => {
    if (!userId) return;
    setStarting(true);
    try {
      await recorder.start(userId, type);
    } catch {
      setError('Recording could not start. Check that location is turned on.');
    } finally {
      setStarting(false);
    }
  };

  return (
    <Screen edges={['bottom']}>
      <SegmentedControl
        options={RECORDABLE_TYPES}
        value={type}
        onChange={setType}
        accessibilityLabel="Activity type"
      />
      {!perm.background ? (
        <Banner message="Tracking pauses if you leave the app or lock the screen. Allow background location in Settings to record with the screen off." />
      ) : null}
      {approximate ? (
        <Banner
          tone="warning"
          message="Precise location is off, so distance and route will be inaccurate. Turn on Precise Location for PACE in Settings."
        />
      ) : null}
      {error ? <Banner tone="danger" message={error} /> : null}
      <Card>
        <Text variant="small" color="textSecondary">
          GPS signal
        </Text>
        <SignalStatus accuracy={accuracy} ready={ready} />
      </Card>
      <Button
        title={ready ? 'Start' : 'Start anyway'}
        variant={ready ? 'primary' : 'secondary'}
        loading={starting}
        onPress={() => void start()}
      />
    </Screen>
  );
}

/** GPS status; spoken only when it changes between searching, ready and weak (not on every fix). */
function SignalStatus({ accuracy, ready }: { accuracy: number | null; ready: boolean }) {
  const signal = accuracy === null ? 'searching' : ready ? 'ready' : 'weak';
  useEffect(() => {
    if (signal !== 'searching')
      announce(signal === 'ready' ? 'GPS ready' : 'GPS signal weak. Move to open sky.');
  }, [signal]);
  return (
    <Text variant="title">
      {accuracy === null
        ? 'Searching…'
        : ready
          ? `Ready (±${Math.round(accuracy)} m)`
          : `Weak (±${Math.round(accuracy)} m) — move to open sky`}
    </Text>
  );
}

function Live() {
  const userId = useAuth().session?.user.id;
  const meta = useActiveRecording(userId);
  const { recording, points } = useLiveRecording(meta);
  const { data: profile } = useProfile();
  const { current } = useWeightStats('30D');
  const showToast = useToast((s) => s.show);
  const now = useNow(1000, meta?.status === 'recording');
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [busy, setBusy] = useState(false);
  const unit = (profile?.unit_system ?? 'metric') as 'metric' | 'imperial';

  // After an app restart the OS subscription may be gone; restart it if still within the window.
  const lastActivity = Math.max(meta?.updatedAt ?? 0, points[points.length - 1]?.t ?? 0);
  const stale = meta ? !canResume({ updatedAt: lastActivity }, now) : false;
  useEffect(() => {
    if (!stale) void recorder.ensureTracking().catch(() => undefined);
  }, [stale]);

  if (!meta || !recording) return null;
  const s = liveStats(recording, now, current?.kg ?? null);
  const paused = meta.status === 'paused';
  const quality = gpsQuality(recording.track);
  const pieces = recording.track.pieces;

  const act = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch {
      showToast('Location updates could not be changed. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen edges={['bottom']}>
      {stale ? (
        <Banner
          tone="warning"
          message="This recording was interrupted more than 6 hours ago. Finish to save what was recorded, or discard it."
        />
      ) : null}
      {meta.mode === 'foreground' && !stale ? (
        <Banner message="Keep PACE open: tracking pauses when the app is in the background." />
      ) : null}
      {quality === 'poor' ? (
        <Banner tone="warning" message="Weak GPS signal. Distance is an estimate and may be off." />
      ) : null}
      <View style={styles.hero}>
        <Text variant="small" color="textSecondary">
          {paused ? 'Paused' : 'Recording'} · {formatClock(s.movingS)}
        </Text>
        <Text variant="hero" numeric>
          {formatDistance(s.distanceM, unit)}
        </Text>
      </View>
      <View style={styles.row}>
        {meta.type === 'cycle' ? (
          <StatTile label="Speed" value={formatSpeed(s.currentSpeedMps, unit)} />
        ) : (
          <StatTile
            label="Pace"
            value={formatPace(s.currentPaceSPerKm, unit)}
            unit={unit === 'metric' ? '/km' : '/mi'}
          />
        )}
        <StatTile
          label="Calories"
          value={s.kcal === null ? '—' : String(Math.round(s.kcal))}
          unit="kcal"
          caption="Estimate"
        />
      </View>
      <View style={styles.row}>
        <StatTile label="Total time" value={formatClock(s.elapsedS)} />
        {meta.type === 'cycle' ? (
          <StatTile label="Avg speed" value={formatSpeed(s.avgSpeedMps, unit)} />
        ) : (
          <StatTile
            label="Avg pace"
            value={formatPace(s.avgPaceSPerKm, unit)}
            unit={unit === 'metric' ? '/km' : '/mi'}
          />
        )}
        <StatTile label="GPS" value={QUALITY_SHORT[quality]} />
      </View>
      <RouteMap pieces={pieces} follow={!paused} height={220} />
      <View style={styles.row}>
        {stale ? null : paused ? (
          <Button
            title="Resume"
            loading={busy}
            fullWidth={false}
            onPress={() => void act(recorder.resume)}
          />
        ) : (
          <Button
            title="Pause"
            variant="secondary"
            loading={busy}
            fullWidth={false}
            onPress={() => void act(recorder.pause)}
          />
        )}
        <Button
          title="Finish"
          fullWidth={false}
          disabled={busy}
          onPress={() =>
            void act(async () => {
              await recorder.stop();
              router.push('/activity/summary');
            })
          }
        />
      </View>
      <Button title="Discard" variant="ghost" onPress={() => setConfirmDiscard(true)} />
      <ConfirmDialog
        visible={confirmDiscard}
        title="Discard this activity?"
        message="The recorded route and stats will be deleted. This can't be undone."
        confirmLabel="Discard"
        destructive
        onCancel={() => setConfirmDiscard(false)}
        onConfirm={() =>
          void act(async () => {
            setConfirmDiscard(false);
            await recorder.clear();
            backToActivities();
          })
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.md },
  row: { flexDirection: 'row', gap: spacing.md, justifyContent: 'center' },
});

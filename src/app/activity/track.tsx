import { router } from 'expo-router';
import { Satellite } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Linking, Platform, StyleSheet, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  FadeOutDown,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Banner, ConfirmDialog, useToast } from '@/components/feedback';
import { Button, Card, Screen, SegmentedControl, Text } from '@/components/ui';
import { formatDistance, formatPace, formatSpeed } from '@/domain/activity/geo';
import { gpsQuality } from '@/domain/activity/gps-filter';
import type { ActivityType } from '@/domain/activity/met';
import { canResume, liveStats } from '@/domain/activity/recording';
import { QUALITY_SHORT, RECORDABLE_TYPES } from '@/features/activity/labels';
import {
  refreshRecordingNotification,
  setRecordingUnit,
} from '@/features/activity/live-notification';
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
import { motion, radius, spacing, useTheme } from '@/theme';
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
  const ticking = useNow(1000, meta?.status === 'recording');
  // Never behind the last pause/resume: right after Resume the ticking clock can still hold a
  // time from before the pause, which made the timer jump backwards for a second.
  const now = Math.max(ticking, meta?.updatedAt ?? 0);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [busy, setBusy] = useState(false);
  const unit = (profile?.unit_system ?? 'metric') as 'metric' | 'imperial';
  const { colors, reduceMotion } = useTheme();
  // The map's own height is animated: when Discard slides in (paused) or out (resumed), the map
  // squeezes or grows smoothly instead of jumping. Space for the map = area − bottom panel.
  const [areaH, setAreaH] = useState(0);
  const [panelH, setPanelH] = useState(0);
  const mapH = useSharedValue(0);
  const target = areaH && panelH ? Math.max(120, areaH - panelH) : 0;
  useEffect(() => {
    if (!target) return;
    mapH.set(
      reduceMotion || mapH.get() === 0
        ? target
        : withTiming(target, { duration: motion.screen, easing: Easing.out(Easing.cubic) }),
    );
  }, [target, reduceMotion, mapH]);
  const mapStyle = useAnimatedStyle(() => ({ height: mapH.get() }));

  // After an app restart the OS subscription may be gone; restart it if still within the window.
  const lastActivity = Math.max(meta?.updatedAt ?? 0, points[points.length - 1]?.t ?? 0);
  const stale = meta ? !canResume({ updatedAt: lastActivity }, now) : false;
  useEffect(() => {
    if (!stale) void recorder.ensureTracking().catch(() => undefined);
  }, [stale]);
  // The notification shows distance in the user's units and keeps its time current while open.
  useEffect(() => {
    void setRecordingUnit(unit);
  }, [unit]);
  const recordingNow = meta?.status === 'recording';
  useEffect(() => {
    if (!recordingNow) return;
    const t = setInterval(() => void refreshRecordingNotification({ throttleMs: 1500 }), 2000);
    return () => clearInterval(t);
  }, [recordingNow]);

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

  const qualityColor =
    quality === 'good' ? colors.accent : quality === 'fair' ? colors.info : colors.warning;

  // Map first (spec 11.1): only distance, time and pace below it while moving. Everything else
  // (calories, averages, total time) is on the summary after Finish.
  return (
    <Screen edges={['bottom']} scroll={false}>
      {stale ? (
        <Banner
          tone="warning"
          message="This recording was interrupted more than 6 hours ago. Finish to save what was recorded, or discard it."
        />
      ) : null}
      {meta.mode === 'foreground' && !stale ? (
        <Banner message="Keep PACE open: tracking pauses when the app is in the background." />
      ) : null}
      <View style={styles.area} onLayout={(e) => setAreaH(Math.round(e.nativeEvent.layout.height))}>
        <Animated.View style={target ? mapStyle : styles.flex}>
          <RouteMap
            pieces={pieces}
            follow={!paused}
            fill
            overlay={
              <View style={styles.badges} pointerEvents="none">
                <View
                  style={[
                    styles.badge,
                    { backgroundColor: paused ? colors.warningSurface : colors.surface },
                  ]}
                >
                  <View
                    style={[
                      styles.dot,
                      { backgroundColor: paused ? colors.warning : colors.danger },
                    ]}
                  />
                  <Text variant="small" style={styles.badgeText}>
                    {paused ? 'Paused' : 'Recording'}
                  </Text>
                </View>
                <View
                  style={[styles.badge, { backgroundColor: colors.surface }]}
                  accessible
                  accessibilityLabel={`GPS signal ${QUALITY_SHORT[quality]}${quality === 'poor' ? '. Distance may be off' : ''}`}
                >
                  <Satellite size={16} color={qualityColor} />
                  <Text variant="small" style={[styles.badgeText, { color: qualityColor }]}>
                    {quality === 'poor' ? 'Weak GPS' : `GPS ${QUALITY_SHORT[quality]}`}
                  </Text>
                </View>
              </View>
            }
          />
        </Animated.View>
        <View
          style={styles.panel}
          onLayout={(e) => setPanelH(Math.round(e.nativeEvent.layout.height))}
        >
          <View style={styles.stats}>
            <Text
              variant="hero"
              numeric
              align="center"
              accessibilityLabel={`Distance ${formatDistance(s.distanceM, unit)}`}
            >
              {formatDistance(s.distanceM, unit)}
            </Text>
            <View style={styles.pair}>
              <Figure label="Time" value={formatClock(s.movingS)} />
              {meta.type === 'cycle' ? (
                <Figure label="Speed" value={formatSpeed(s.currentSpeedMps, unit)} />
              ) : (
                <Figure
                  label={unit === 'metric' ? 'Pace /km' : 'Pace /mi'}
                  value={formatPace(s.currentPaceSPerKm, unit)}
                />
              )}
            </View>
          </View>
          <View style={styles.controls}>
            {stale ? null : paused ? (
              <View style={styles.flex}>
                <Button title="Resume" loading={busy} onPress={() => void act(recorder.resume)} />
              </View>
            ) : (
              <View style={styles.flex}>
                <Button
                  title="Pause"
                  variant="secondary"
                  loading={busy}
                  onPress={() => void act(recorder.pause)}
                />
              </View>
            )}
            <View style={styles.flex}>
              <Button
                title="Finish"
                variant={paused || stale ? 'secondary' : 'primary'}
                disabled={busy}
                onPress={() =>
                  void act(async () => {
                    await recorder.stop();
                    router.push('/activity/summary');
                  })
                }
              />
            </View>
          </View>
          {/* Discard only while paused: one less button while moving. It slides up from below. */}
          {paused || stale ? (
            <Animated.View
              entering={
                reduceMotion ? FadeIn.duration(motion.normal) : FadeInDown.duration(motion.screen)
              }
              exiting={
                reduceMotion ? FadeOut.duration(motion.normal) : FadeOutDown.duration(motion.screen)
              }
            >
              <Button title="Discard" variant="ghost" onPress={() => setConfirmDiscard(true)} />
            </Animated.View>
          ) : null}
        </View>
      </View>
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

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.figure} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text variant="display" numeric numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text variant="small" color="textSecondary">
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  badges: { flexDirection: 'row', gap: spacing.xs, padding: spacing.sm, flexWrap: 'wrap' },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    opacity: 0.95,
  },
  badgeText: { fontWeight: '600' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  area: { flex: 1, overflow: 'hidden' },
  panel: { gap: spacing.md, paddingTop: spacing.md },
  stats: { gap: spacing.xs },
  pair: { flexDirection: 'row' },
  figure: { flex: 1, alignItems: 'center' },
  controls: { flexDirection: 'row', gap: spacing.sm },
});

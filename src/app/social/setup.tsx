import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Card, Screen, Text, TextField, Toggle } from '@/components/ui';
import {
  avatarColorFor,
  HANDLE_MAX,
  handleFor,
  SOCIAL_ERRORS,
  SOCIAL_NAME_ERROR_TEXT,
  suggestSocialName,
  validateSocialName,
} from '@/domain/social';
import { useAuth } from '@/features/auth/AuthProvider';
import { useProfile } from '@/features/profile/api';
import { Avatar } from '@/features/social/components/Avatar';
import { OfflineNote } from '@/features/social/components/OfflineNote';
import {
  errorCode,
  isHandleAvailable,
  type SocialSetup,
  useCompleteSocialSetup,
  useMySocialProfile,
  useOnline,
} from '@/features/social/api';
import { spacing } from '@/theme';

/** What can never be shared, shown before anything is chosen (spec 3.4). */
export const NEVER_SHARED = [
  'Weight, body measurements and goal numbers',
  'Check-ins, pain, injuries and health',
  'Notes',
  'GPS routes and where you start or finish',
  'The time of day you train (only the date is shown)',
];

type ShareKey = 'workouts' | 'activities' | 'milestones' | 'challenges';

/**
 * Turning social on (spec 33.1): (1) who you are, (2) what friends see (all off), (3) leaderboards
 * and friend requests. Finishing records the social consent and opens the Social tab.
 */
export default function SocialSetupScreen() {
  const { then } = useLocalSearchParams<{ then?: string }>();
  const own = useProfile().data;
  const userId = useAuth().session?.user.id ?? '';
  const existing = useMySocialProfile().data;
  const online = useOnline();
  const complete = useCompleteSocialSetup();

  const [step, setStep] = useState(0);
  // The username is chosen once. When social is turned on again, the existing identity is kept.
  const [name, setName] = useState(
    existing?.display_name ?? suggestSocialName(own?.display_name ?? ''),
  );
  const color = existing?.avatar_color ?? avatarColorFor(userId);
  const [nameError, setNameError] = useState<string>();
  const [checking, setChecking] = useState(false);
  const [share, setShare] = useState<Record<ShareKey, boolean>>({
    workouts: false,
    activities: false,
    milestones: false,
    challenges: false,
  });
  const [shareVolume, setShareVolume] = useState(false);
  const [leaderboards, setLeaderboards] = useState(false);
  const [requests, setRequests] = useState(true);

  const nextFromIdentity = async () => {
    if (existing) return setStep(1);
    const n = validateSocialName(name);
    setNameError(n ? SOCIAL_NAME_ERROR_TEXT[n] : undefined);
    if (n) return;
    setChecking(true);
    try {
      if (!(await isHandleAvailable(handleFor(name)))) {
        setNameError(SOCIAL_ERRORS.handle_taken);
        return;
      }
      setStep(1);
    } catch (e) {
      setNameError(SOCIAL_ERRORS[errorCode(e)]);
    } finally {
      setChecking(false);
    }
  };

  const finish = () => {
    const audience = (on: boolean) => (on ? 'friends' : 'private');
    const setup: SocialSetup = {
      displayName: name.trim(),
      settings: {
        workouts_audience: audience(share.workouts),
        activities_audience: audience(share.activities),
        milestones_audience: audience(share.milestones),
        challenge_results_audience: audience(share.challenges),
        share_volume: share.workouts && shareVolume,
        in_leaderboards: leaderboards,
        friend_requests_from: requests ? 'everyone' : 'nobody',
      },
    };
    complete.mutate(setup, {
      onSuccess: () => {
        if (then) router.replace({ pathname: '/social/user/[handle]', params: { handle: then } });
        else router.replace('/social');
      },
      onError: (e) => {
        const code = errorCode(e);
        if (code === 'handle_taken' || code === 'handle_reserved' || code === 'not_allowed') {
          setNameError(SOCIAL_ERRORS[code]);
          setStep(0);
        }
      },
    });
  };

  const footer =
    step === 0 ? (
      <Button
        title="Next"
        loading={checking}
        disabled={!online}
        onPress={() => void nextFromIdentity()}
      />
    ) : step === 1 ? (
      <View style={styles.footerRow}>
        <Button title="Back" variant="ghost" fullWidth={false} onPress={() => setStep(0)} />
        <View style={styles.flex}>
          <Button title="Next" onPress={() => setStep(2)} />
        </View>
      </View>
    ) : (
      <View style={styles.footerRow}>
        <Button title="Back" variant="ghost" fullWidth={false} onPress={() => setStep(1)} />
        <View style={styles.flex}>
          <Button
            title="Turn on social"
            loading={complete.isPending}
            disabled={!online}
            onPress={finish}
          />
        </View>
      </View>
    );

  return (
    <Screen locked={checking || complete.isPending} edges={['bottom']} footer={footer}>
      <Text variant="small" color="textSecondary">
        Step {step + 1} of 3
      </Text>
      {!online ? <OfflineNote /> : null}

      {step === 0 ? (
        <>
          <Text variant="heading" accessibilityRole="header">
            How friends see you
          </Text>
          <Text variant="body" color="textSecondary">
            Pick your username. Friends find you by it, and only your username and colour are
            visible to them.
          </Text>
          <View style={styles.preview}>
            <Avatar name={name.trim() || '?'} color={color} size={64} />
            <Text variant="title" accessibilityLiveRegion="polite">
              {name.trim() ? `@${handleFor(name)}` : '@'}
            </Text>
          </View>
          {existing ? (
            <Text variant="body" color="textSecondary">
              You are {existing.display_name}. Your username stays the same.
            </Text>
          ) : (
            <TextField
              label="Username"
              value={name}
              onChangeText={(v) => {
                setName(v.replace(/\s/g, ''));
                setNameError(undefined);
              }}
              maxLength={HANDLE_MAX}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="username"
              hint="3–20 letters, numbers, _ or . without spaces. It can’t be changed later."
              error={nameError}
              onSubmitEditing={() => void nextFromIdentity()}
            />
          )}
        </>
      ) : null}

      {step === 1 ? (
        <>
          <Text variant="heading" accessibilityRole="header">
            What friends see
          </Text>
          <Text variant="body" color="textSecondary">
            Everything is private until you choose. You can change this any time, and hide single
            items later.
          </Text>
          <Toggle
            label="Workouts"
            description="Name, type, duration and number of sets"
            value={share.workouts}
            onChange={(v) => setShare((s) => ({ ...s, workouts: v }))}
          />
          {share.workouts ? (
            <Toggle
              label="Include lifted volume"
              description="The total kilograms of a strength workout"
              value={shareVolume}
              onChange={setShareVolume}
            />
          ) : null}
          <Toggle
            label="Walks, runs and rides"
            description="Type, distance, moving time and pace. Never the route."
            value={share.activities}
            onChange={(v) => setShare((s) => ({ ...s, activities: v }))}
          />
          <Toggle
            label="Milestones"
            description="Training streaks and personal records. Never weight milestones."
            value={share.milestones}
            onChange={(v) => setShare((s) => ({ ...s, milestones: v }))}
          />
          <Toggle
            label="Challenge results"
            description="When you finish a challenge"
            value={share.challenges}
            onChange={(v) => setShare((s) => ({ ...s, challenges: v }))}
          />
          <Card>
            <Text variant="bodyStrong">Never shared</Text>
            {NEVER_SHARED.map((t) => (
              <Text key={t} variant="small" color="textSecondary">
                • {t}
              </Text>
            ))}
          </Card>
          <Text variant="small" color="textSecondary">
            Sharing starts when the friends feed arrives in a coming update; until then nothing is
            shown to anyone.
          </Text>
        </>
      ) : null}

      {step === 2 ? (
        <>
          <Text variant="heading" accessibilityRole="header">
            Friends and leaderboards
          </Text>
          <Toggle
            label="Allow friend requests"
            description="Anyone who finds your handle can ask to be your friend."
            value={requests}
            onChange={setRequests}
          />
          <Toggle
            label="Appear in leaderboards"
            description="Rank by effort only (workouts, active minutes, distance, active days) among friends and clubs. Never weight or body data."
            value={leaderboards}
            onChange={setLeaderboards}
          />
          <Card>
            <Text variant="small" color="textSecondary">
              You can block or report anyone, and turn social off or delete your social profile in
              Settings → Social and privacy. By turning on social you agree to the community rules
              in the terms of use.
            </Text>
          </Card>
          <Button
            title="Read the privacy policy"
            variant="ghost"
            onPress={() => router.push('/legal/privacy')}
          />
          {complete.isError ? (
            <Text variant="small" color="danger" accessibilityRole="alert">
              {SOCIAL_ERRORS[errorCode(complete.error)]}
            </Text>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  footerRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  preview: { alignItems: 'center', paddingVertical: spacing.xs, gap: spacing.xs },
});

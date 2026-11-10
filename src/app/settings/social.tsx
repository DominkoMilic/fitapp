import { goBack } from '@/navigation/back';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ConfirmDialog, ErrorState, LoadingState, useToast } from '@/components/feedback';
import {
  Button,
  Card,
  ListItem,
  Screen,
  SectionHeader,
  Text,
  TextField,
  Toggle,
} from '@/components/ui';
import { PressableScale } from '@/components/ui/PressableScale';
import {
  AVATAR_COLOR_KEYS,
  avatarHex,
  BIO_MAX,
  DISPLAY_NAME_MAX,
  HANDLE_ERROR_TEXT,
  HANDLE_MAX,
  normaliseHandle,
  SOCIAL_ERRORS,
  validateBio,
  validateDisplayName,
  validateHandle,
} from '@/domain/social';
import { useFeatures } from '@/features/profile/features';
import {
  errorCode,
  type SocialSettings,
  useDeleteSocialProfile,
  useMySocialProfile,
  useOnline,
  useSetSocialEnabled,
  useSocialSettings,
  useUpdateSocialProfile,
  useUpdateSocialSettings,
} from '@/features/social/api';
import { Avatar } from '@/features/social/components/Avatar';
import { OfflineNote } from '@/features/social/components/OfflineNote';
import { spacing, TOUCH_TARGET, useTheme } from '@/theme';

type AudienceKey =
  | 'workouts_audience'
  | 'activities_audience'
  | 'milestones_audience'
  | 'challenge_results_audience';

const AUDIENCES: readonly { key: AudienceKey; label: string; description: string }[] = [
  { key: 'workouts_audience', label: 'Workouts', description: 'Name, type, duration and sets' },
  {
    key: 'activities_audience',
    label: 'Walks, runs and rides',
    description: 'Distance, time and pace. Never the route.',
  },
  {
    key: 'milestones_audience',
    label: 'Milestones',
    description: 'Streaks and records. Never weight milestones.',
  },
  {
    key: 'challenge_results_audience',
    label: 'Challenge results',
    description: 'When you finish a challenge',
  },
];

/** Settings → Social and privacy (spec 33.5). */
export default function SocialSettingsScreen() {
  const { colors } = useTheme();
  const me = useMySocialProfile();
  const settings = useSocialSettings();
  const features = useFeatures();
  const online = useOnline();
  const updateProfile = useUpdateSocialProfile();
  const updateSettings = useUpdateSocialSettings();
  const setEnabled = useSetSocialEnabled();
  const del = useDeleteSocialProfile();
  const showToast = useToast((s) => s.show);

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [handle, setHandle] = useState('');
  const [bio, setBio] = useState('');
  const [color, setColor] = useState('mint');
  const [errors, setErrors] = useState<{ name?: string; handle?: string; bio?: string }>({});
  const [confirm, setConfirm] = useState<'off' | 'delete' | null>(null);

  if (me.isPending || settings.isPending)
    return (
      <Screen edges={['bottom']}>
        <LoadingState />
      </Screen>
    );
  if (me.isError || settings.isError)
    return (
      <Screen edges={['bottom']}>
        <ErrorState
          message="Your social settings couldn’t be loaded."
          onRetry={() => {
            void me.refetch();
            void settings.refetch();
          }}
        />
      </Screen>
    );
  const p = me.data;
  const s = settings.data;
  if (!p || !s)
    return (
      <Screen edges={['bottom']}>
        <Card>
          <Text variant="body">
            Social isn’t set up. Turn it on to add friends; nothing is shared until you choose.
          </Text>
        </Card>
        <Button title="Set up social" onPress={() => router.push('/social/setup')} />
      </Screen>
    );

  const startEdit = () => {
    setName(p.display_name);
    setHandle(p.handle);
    setBio(p.bio ?? '');
    setColor(p.avatar_color);
    setErrors({});
    setEditing(true);
  };

  const saveProfile = () => {
    const n = validateDisplayName(name);
    const h = validateHandle(handle);
    const b = validateBio(bio);
    const next = {
      name:
        n === 'required'
          ? 'Enter a name.'
          : n === 'too_long'
            ? `At most ${DISPLAY_NAME_MAX} characters.`
            : n
              ? 'That name is not allowed.'
              : undefined,
      handle: h ? HANDLE_ERROR_TEXT[h] : undefined,
      bio:
        b === 'too_long'
          ? `At most ${BIO_MAX} characters.`
          : b
            ? 'That text is not allowed.'
            : undefined,
    };
    setErrors(next);
    if (next.name || next.handle || next.bio) return;
    updateProfile.mutate(
      {
        display_name: name.trim(),
        handle: normaliseHandle(handle),
        bio: bio.trim() || null,
        avatar_color: color,
      },
      {
        onSuccess: () => {
          setEditing(false);
          showToast('Profile saved');
        },
        onError: (e) => {
          const code = errorCode(e);
          if (code === 'handle_taken' || code === 'handle_reserved')
            setErrors({ handle: SOCIAL_ERRORS[code] });
          else showToast(SOCIAL_ERRORS[code]);
        },
      },
    );
  };

  const saveSetting = (
    patch: Partial<
      Pick<
        SocialSettings,
        | AudienceKey
        | 'share_volume'
        | 'in_leaderboards'
        | 'friend_requests_from'
        | 'notify_cheers'
        | 'notify_comments'
        | 'notify_requests'
      >
    >,
  ) => updateSettings.mutate(patch, { onError: (e) => showToast(SOCIAL_ERRORS[errorCode(e)]) });
  // Show the pending value while a change saves.
  const pending = updateSettings.isPending ? updateSettings.variables : undefined;
  const value = <K extends keyof SocialSettings>(k: K): SocialSettings[K] =>
    pending && k in pending ? (pending as SocialSettings)[k] : s[k];

  return (
    <Screen edges={['bottom']}>
      {!online ? <OfflineNote /> : null}

      <SectionHeader title="Your social profile" />
      {editing ? (
        <>
          <View style={styles.center}>
            <Avatar name={name || '?'} color={color} size={64} />
          </View>
          <TextField
            label="Name"
            value={name}
            onChangeText={setName}
            maxLength={DISPLAY_NAME_MAX}
            error={errors.name}
          />
          <TextField
            label="Handle"
            value={handle}
            onChangeText={(v) => setHandle(v.replace(/\s/g, '').toLowerCase())}
            maxLength={HANDLE_MAX + 1}
            autoCapitalize="none"
            autoCorrect={false}
            error={errors.handle}
            hint="Changing it breaks invite links you already sent."
          />
          <TextField
            label="Bio (optional)"
            value={bio}
            onChangeText={setBio}
            maxLength={BIO_MAX}
            multiline
            error={errors.bio}
            hint={`${bio.length}/${BIO_MAX}`}
          />
          <View style={styles.colors} accessibilityRole="radiogroup">
            {AVATAR_COLOR_KEYS.map((k) => (
              <PressableScale
                key={k}
                accessibilityRole="radio"
                accessibilityLabel={`Colour ${k}`}
                accessibilityState={{ selected: color === k }}
                onPress={() => setColor(k)}
                style={[
                  styles.swatch,
                  {
                    backgroundColor: avatarHex(k),
                    borderColor: color === k ? colors.textPrimary : 'transparent',
                  },
                ]}
              />
            ))}
          </View>
          <Button
            title="Save profile"
            loading={updateProfile.isPending}
            disabled={!online}
            onPress={saveProfile}
          />
          <Button title="Cancel" variant="ghost" onPress={() => setEditing(false)} />
        </>
      ) : (
        <>
          <View style={styles.me}>
            <Avatar name={p.display_name} color={p.avatar_color} size={56} />
            <View style={styles.flex}>
              <Text variant="title">{p.display_name}</Text>
              <Text variant="small" color="textSecondary">
                @{p.handle}
              </Text>
            </View>
          </View>
          {p.bio ? <Text variant="body">{p.bio}</Text> : null}
          <ListItem
            title="Edit profile"
            subtitle="Name, handle, bio and colour"
            onPress={startEdit}
          />
        </>
      )}
      <Toggle
        label="Findable by handle"
        description="Off: only people you’re already connected with can see you."
        value={p.discoverable}
        onChange={(v) =>
          updateProfile.mutate(
            { discoverable: v },
            { onError: (e) => showToast(SOCIAL_ERRORS[errorCode(e)]) },
          )
        }
      />
      <Toggle
        label="Allow friend requests"
        value={value('friend_requests_from') === 'everyone'}
        onChange={(v) => saveSetting({ friend_requests_from: v ? 'everyone' : 'nobody' })}
      />

      <SectionHeader title="What friends see" />
      <Text variant="small" color="textSecondary">
        New items you share appear in your friends’ feeds. Weight, health, notes, routes and the
        time of day are never shared. Turning a type off doesn’t remove earlier posts; remove those
        from the post’s ⋯ menu.
      </Text>
      {AUDIENCES.map((a) => (
        <Toggle
          key={a.key}
          label={a.label}
          description={a.description}
          value={value(a.key) !== 'private'}
          onChange={(v) => saveSetting({ [a.key]: v ? 'friends' : 'private' })}
        />
      ))}
      {value('workouts_audience') !== 'private' ? (
        <Toggle
          label="Include lifted volume"
          value={value('share_volume')}
          onChange={(v) => saveSetting({ share_volume: v })}
        />
      ) : null}
      <Toggle
        label="Appear in leaderboards"
        description="Effort only, among friends and clubs."
        value={value('in_leaderboards')}
        onChange={(v) => saveSetting({ in_leaderboards: v })}
      />

      <SectionHeader title="Notifications" />
      <Text variant="small" color="textSecondary">
        Push notifications arrive in a coming update. These choices are saved for when they do.
      </Text>
      <Toggle
        label="Cheers"
        value={value('notify_cheers')}
        onChange={(v) => saveSetting({ notify_cheers: v })}
      />
      <Toggle
        label="Comments"
        value={value('notify_comments')}
        onChange={(v) => saveSetting({ notify_comments: v })}
      />
      <Toggle
        label="Friend requests"
        value={value('notify_requests')}
        onChange={(v) => saveSetting({ notify_requests: v })}
      />

      <SectionHeader title="Safety" />
      <ListItem title="Blocked people" onPress={() => router.push('/settings/blocked')} />
      <ListItem
        title="Community rules"
        subtitle="In the terms of use"
        onPress={() => router.push('/legal/terms')}
      />

      <SectionHeader title="Social" />
      {features.social ? (
        <ListItem
          title="Turn social off"
          subtitle="Hides the Social tab and you from search. Friends are kept."
          onPress={() => setConfirm('off')}
        />
      ) : (
        <Button
          title="Turn social on"
          disabled={!online}
          loading={setEnabled.isPending}
          onPress={() =>
            setEnabled.mutate(true, { onError: (e) => showToast(SOCIAL_ERRORS[errorCode(e)]) })
          }
        />
      )}
      <ListItem
        title="Delete my social profile"
        subtitle="Removes your handle, friends and requests"
        destructive
        onPress={() => setConfirm('delete')}
      />

      <ConfirmDialog
        visible={confirm === 'off'}
        title="Turn social off?"
        message="The Social tab disappears and people can’t find you or send requests. Your friends and profile are kept for when you turn it back on."
        confirmLabel="Turn off"
        loading={setEnabled.isPending}
        onCancel={() => setConfirm(null)}
        onConfirm={() =>
          setEnabled.mutate(false, {
            onSuccess: () => showToast('Social is off'),
            onError: (e) => showToast(SOCIAL_ERRORS[errorCode(e)]),
            onSettled: () => setConfirm(null),
          })
        }
      />
      <ConfirmDialog
        visible={confirm === 'delete'}
        title="Delete your social profile?"
        message="Your handle, friends and requests are deleted and social is turned off. People you blocked stay blocked. Your training data isn’t affected. This can’t be undone."
        confirmLabel="Delete"
        destructive
        loading={del.isPending}
        onCancel={() => setConfirm(null)}
        onConfirm={() =>
          del.mutate(undefined, {
            onSuccess: () => {
              showToast('Social profile deleted');
              goBack('/profile');
            },
            onError: (e) => showToast(SOCIAL_ERRORS[errorCode(e)]),
            onSettled: () => setConfirm(null),
          })
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center' },
  me: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
  colors: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  swatch: {
    width: TOUCH_TARGET,
    height: TOUCH_TARGET,
    borderRadius: TOUCH_TARGET / 2,
    borderWidth: 3,
  },
});

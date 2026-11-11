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
  FormLock,
  Text,
  TextField,
  Toggle,
} from '@/components/ui';
import { BIO_MAX, SOCIAL_ERRORS, validateBio } from '@/domain/social';
import { useFeatures } from '@/features/profile/features';
import {
  errorCode,
  type SocialSettings,
  hiddenPostCount,
  useDeleteSocialProfile,
  useHideMyPosts,
  useShowMyPosts,
  useMySocialProfile,
  useOnline,
  useSetSocialEnabled,
  useSocialSettings,
  useUpdateSocialProfile,
  useUpdateSocialSettings,
} from '@/features/social/api';
import { Avatar } from '@/features/social/components/Avatar';
import { OfflineNote } from '@/features/social/components/OfflineNote';
import { spacing } from '@/theme';

type AudienceKey =
  | 'workouts_audience'
  | 'activities_audience'
  | 'milestones_audience'
  | 'challenge_results_audience';

interface Audience {
  key: AudienceKey;
  /** The feed item kind this setting shares. */
  kind: string;
  label: string;
  /** Lower-case plural for dialogs: "your earlier workouts". */
  noun: string;
  description: string;
}

const AUDIENCES: readonly Audience[] = [
  {
    key: 'workouts_audience',
    kind: 'workout',
    label: 'Workouts',
    noun: 'workouts',
    description: 'Name, type, duration and sets',
  },
  {
    key: 'activities_audience',
    kind: 'activity',
    label: 'Walks, runs and rides',
    noun: 'walks, runs and rides',
    description: 'Distance, time and pace. Never a map or location.',
  },
  {
    key: 'milestones_audience',
    kind: 'milestone',
    label: 'Milestones',
    noun: 'milestones',
    description: 'Streaks and records. Never weight milestones.',
  },
  {
    key: 'challenge_results_audience',
    kind: 'challenge_done',
    label: 'Challenge results',
    noun: 'challenge results',
    description: 'When you finish a challenge',
  },
];

/** Settings → Social and privacy (spec 33.5). */
export default function SocialSettingsScreen() {
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
  const [bio, setBio] = useState('');
  const [errors, setErrors] = useState<{ bio?: string }>({});
  const [confirm, setConfirm] = useState<'off' | 'delete' | null>(null);
  // After switching a type off: offer to hide its earlier posts; after switching it on: offer to
  // show again the ones hidden that way.
  const [earlier, setEarlier] = useState<{
    audience: Audience;
    mode: 'hide' | 'show';
    count: number;
  } | null>(null);
  const hidePosts = useHideMyPosts();
  const showPosts = useShowMyPosts();

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
    setBio(p.bio ?? '');
    setErrors({});
    setEditing(true);
  };

  const saveProfile = () => {
    const b = validateBio(bio);
    const next = {
      bio:
        b === 'too_long'
          ? `At most ${BIO_MAX} characters.`
          : b
            ? 'That text is not allowed.'
            : undefined,
    };
    setErrors(next);
    if (next.bio) return;
    updateProfile.mutate(
      { bio: bio.trim() || null },
      {
        onSuccess: () => {
          setEditing(false);
          showToast('Profile saved');
        },
        onError: (e) => {
          const code = errorCode(e);
          if (code === 'not_allowed') setErrors({ bio: SOCIAL_ERRORS[code] });
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
        | 'share_route_shape'
        | 'in_leaderboards'
        | 'friend_requests_from'
        | 'notify_cheers'
        | 'notify_comments'
        | 'notify_requests'
        | 'notify_flagged'
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
      {/* The username, handle and colour are fixed (spec 33.8); only the bio can change. */}
      <View style={styles.me}>
        <Avatar name={p.display_name} color={p.avatar_color} size={56} />
        <View style={styles.flex}>
          <Text variant="title">{p.display_name}</Text>
          <Text variant="small" color="textSecondary">
            @{p.handle}
          </Text>
        </View>
      </View>
      {editing ? (
        <>
          <FormLock locked={updateProfile.isPending}>
            <TextField
              label="Bio (optional)"
              value={bio}
              onChangeText={setBio}
              maxLength={BIO_MAX}
              multiline
              error={errors.bio}
              hint={`${bio.length}/${BIO_MAX}`}
            />
          </FormLock>
          <Button
            title="Save bio"
            loading={updateProfile.isPending}
            disabled={!online}
            onPress={saveProfile}
          />
          <Button title="Cancel" variant="ghost" onPress={() => setEditing(false)} />
        </>
      ) : (
        <>
          {p.bio ? <Text variant="body">{p.bio}</Text> : null}
          <ListItem
            title={p.bio ? 'Edit bio' : 'Add a bio'}
            subtitle="Your username and colour can’t be changed."
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
        time of day are never shared. When you turn a type off, you can also hide what you shared
        earlier.
      </Text>
      {AUDIENCES.map((a) => (
        <Toggle
          key={a.key}
          label={a.label}
          description={a.description}
          value={value(a.key) !== 'private'}
          onChange={(v) => {
            saveSetting({ [a.key]: v ? 'friends' : 'private' });
            if (!v) setEarlier({ audience: a, mode: 'hide', count: 0 });
            else
              void hiddenPostCount(a.kind)
                .then((count) => count > 0 && setEarlier({ audience: a, mode: 'show', count }))
                .catch(() => undefined);
          }}
        />
      ))}
      {value('workouts_audience') !== 'private' ? (
        <Toggle
          label="Include lifted volume"
          value={value('share_volume')}
          onChange={(v) => saveSetting({ share_volume: v })}
        />
      ) : null}
      {value('activities_audience') !== 'private' ? (
        <Toggle
          label="Share route shape"
          description="Friends see the line of your route, never a map or where it was."
          value={value('share_route_shape')}
          onChange={(v) => saveSetting({ share_route_shape: v })}
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
        Notifications on this phone when friends cheer, comment or send a request. Never between
        22:00 and 06:00; several at once arrive as one.
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
        label="Rude comment alerts"
        description="When a comment on your post may be rude, so you can remove it."
        value={value('notify_flagged')}
        onChange={(v) => saveSetting({ notify_flagged: v })}
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
        visible={earlier?.mode === 'hide'}
        title={`Hide your earlier ${earlier?.audience.noun ?? ''} too?`}
        message="New ones won’t be shared any more. You can also hide the ones you already shared, so friends no longer see them. They come back if you turn sharing on again and choose to show them."
        confirmLabel="Hide them"
        cancelLabel="Keep them"
        loading={hidePosts.isPending}
        onCancel={() => setEarlier(null)}
        onConfirm={() =>
          earlier &&
          hidePosts.mutate(earlier.audience.kind, {
            onSuccess: (n) =>
              showToast(
                n === 0 ? 'Nothing to hide' : n === 1 ? '1 post hidden' : `${n} posts hidden`,
              ),
            onError: (e) => showToast(SOCIAL_ERRORS[errorCode(e)]),
            onSettled: () => setEarlier(null),
          })
        }
      />
      <ConfirmDialog
        visible={earlier?.mode === 'show'}
        title={`Show your earlier ${earlier?.audience.noun ?? ''} again?`}
        message={`${earlier?.count === 1 ? '1 post was' : `${earlier?.count ?? 0} posts were`} hidden when you turned this off. Posts you removed one by one stay removed.`}
        confirmLabel="Show them"
        cancelLabel="Not now"
        loading={showPosts.isPending}
        onCancel={() => setEarlier(null)}
        onConfirm={() =>
          earlier &&
          showPosts.mutate(earlier.audience.kind, {
            onSuccess: (n) => showToast(n === 1 ? '1 post shown again' : `${n} posts shown again`),
            onError: (e) => showToast(SOCIAL_ERRORS[errorCode(e)]),
            onSettled: () => setEarlier(null),
          })
        }
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
  me: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
});

import {
  type InfiniteData,
  onlineManager,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';
import { z } from 'zod';

import { type Relationship, type SocialErrorCode, socialErrorCode } from '@/domain/social';
import { envResult } from '@/config/env';
import { useAuth } from '@/features/auth/AuthProvider';
import { profileKeys } from '@/features/profile/api';
import { requireSupabase } from '@/integrations/supabase/client';
import type { Tables, TablesUpdate } from '@/integrations/supabase/database.types';

/**
 * Social repository (spec 33, Phase 8A). Social writes are online-only: they go straight to the
 * database functions, which check permissions, blocks and limits. Nothing is queued offline.
 */

export type SocialProfile = Tables<'social_profiles'>;
export type SocialSettings = Tables<'social_settings'>;

export const socialKeys = {
  all: ['social'] as const,
  me: (uid: string) => ['social', uid, 'me'] as const,
  settings: (uid: string) => ['social', uid, 'settings'] as const,
  friendships: (uid: string) => ['social', uid, 'friendships'] as const,
  blocked: (uid: string) => ['social', uid, 'blocked'] as const,
  profile: (uid: string, handle: string) => ['social', uid, 'profile', handle] as const,
  search: (uid: string, q: string) => ['social', uid, 'search', q] as const,
  feed: (uid: string, owner: string | null) => ['social', uid, 'feed', owner ?? 'all'] as const,
  item: (uid: string, id: string) => ['social', uid, 'item', id] as const,
  comments: (uid: string, id: string) => ['social', uid, 'comments', id] as const,
};

const db = () => requireSupabase();
const legalVersion = () => (envResult.ok ? envResult.env.legalVersion : 'unknown');

const relationship = z.enum(['none', 'outgoing', 'incoming', 'friends', 'blocked']);

const friendRow = z.object({
  user_id: z.string(),
  handle: z.string(),
  display_name: z.string(),
  avatar_color: z.string(),
  relationship,
  since: z.string(),
});
export type FriendRow = z.infer<typeof friendRow>;

const searchRow = z.object({
  handle: z.string(),
  display_name: z.string(),
  avatar_color: z.string(),
  relationship,
});
export type SearchRow = z.infer<typeof searchRow>;

const publicProfile = z.object({
  user_id: z.string(),
  handle: z.string(),
  display_name: z.string(),
  avatar_color: z.string(),
  bio: z.string().nullable(),
  relationship,
  friend_count: z.number(),
});
export type PublicProfile = z.infer<typeof publicProfile>;

const blockedRow = z.object({
  user_id: z.string(),
  handle: z.string().nullable(),
  display_name: z.string().nullable(),
  avatar_color: z.string().nullable(),
  blocked_at: z.string(),
});
export type BlockedRow = z.infer<typeof blockedRow>;

/** A social action failure, carrying the code the UI maps to a message. */
export class SocialError extends Error {
  constructor(readonly code: SocialErrorCode) {
    super(code);
  }
}

function fail(error: unknown): never {
  throw new SocialError(socialErrorCode(error as { message?: string; code?: string }));
}

function unwrap<T>(result: { data: T; error: unknown }): T {
  if (result.error) fail(result.error);
  return result.data;
}

export function errorCode(e: unknown): SocialErrorCode {
  return e instanceof SocialError ? e.code : socialErrorCode(e as { message?: string });
}

/** True while the device is online (React Query's network state, fed by NetInfo). */
export function useOnline(): boolean {
  return useSyncExternalStore(
    (cb) => onlineManager.subscribe(cb),
    () => onlineManager.isOnline(),
    () => true,
  );
}

function useUid() {
  return useAuth().session?.user.id;
}

function useSocialQuery<T>(
  key: (uid: string) => readonly unknown[],
  fn: (uid: string) => Promise<T>,
  enabled = true,
) {
  const uid = useUid();
  return useQuery({
    queryKey: key(uid ?? 'anonymous'),
    queryFn: () => fn(uid as string),
    enabled: !!uid && enabled,
  });
}

function useSocialMutation<V, R = void>(fn: (uid: string, vars: V) => Promise<R>) {
  const uid = useUid();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: V) => {
      if (!uid) throw new SocialError('unknown');
      if (!onlineManager.isOnline()) throw new SocialError('network');
      return fn(uid, vars);
    },
    // Profile keys too: the social switch lives in user_preferences.
    onSettled: async () => {
      await qc.invalidateQueries({ queryKey: socialKeys.all });
      await qc.invalidateQueries({ queryKey: profileKeys.all });
    },
  });
}

// ---------------------------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------------------------

export const useMySocialProfile = () =>
  useSocialQuery(socialKeys.me, async (uid) =>
    unwrap(await db().from('social_profiles').select('*').eq('user_id', uid).maybeSingle()),
  );

export const useSocialSettings = () =>
  useSocialQuery(socialKeys.settings, async (uid) =>
    unwrap(await db().from('social_settings').select('*').eq('user_id', uid).maybeSingle()),
  );

export const useFriendships = (enabled = true) =>
  useSocialQuery(
    socialKeys.friendships,
    async () => z.array(friendRow).parse(unwrap(await db().rpc('list_friendships'))),
    enabled,
  );

export const useBlocked = () =>
  useSocialQuery(socialKeys.blocked, async () =>
    z.array(blockedRow).parse(unwrap(await db().rpc('list_blocked'))),
  );

export const useSocialProfile = (handle: string) =>
  useSocialQuery(
    (uid) => socialKeys.profile(uid, handle),
    async () => {
      const rows = z
        .array(publicProfile)
        .parse(unwrap(await db().rpc('get_social_profile', { p_handle: handle })));
      return rows[0] ?? null;
    },
    !!handle,
  );

/** Handle search; needs at least 3 characters (the server ignores shorter queries). */
export const useProfileSearch = (q: string) =>
  useSocialQuery(
    (uid) => socialKeys.search(uid, q),
    async () => z.array(searchRow).parse(unwrap(await db().rpc('search_social_profiles', { q }))),
    q.length >= 3,
  );

export async function isHandleAvailable(handle: string): Promise<boolean> {
  const { data, error } = await db().rpc('social_handle_available', { p_handle: handle });
  if (error) fail(error);
  return data === true;
}

// ---------------------------------------------------------------------------------------------
// Setup and settings
// ---------------------------------------------------------------------------------------------

export interface SocialSetup {
  handle: string;
  displayName: string;
  avatarColor: string;
  settings: Pick<
    TablesUpdate<'social_settings'>,
    | 'workouts_audience'
    | 'activities_audience'
    | 'milestones_audience'
    | 'challenge_results_audience'
    | 'share_volume'
    | 'in_leaderboards'
    | 'friend_requests_from'
    | 'notify_cheers'
    | 'notify_comments'
    | 'notify_requests'
  >;
}

/** Creates (or updates) the profile and settings, records the consent and switches social on. */
export const useCompleteSocialSetup = () =>
  useSocialMutation<SocialSetup>(async (uid, s) => {
    const profile = {
      handle: s.handle,
      display_name: s.displayName.trim(),
      avatar_color: s.avatarColor,
    };
    // Users may not change user_id, so an existing profile is updated rather than upserted.
    const existing = unwrap(
      await db().from('social_profiles').select('user_id').eq('user_id', uid).maybeSingle(),
    );
    unwrap(
      existing
        ? await db().from('social_profiles').update(profile).eq('user_id', uid)
        : await db()
            .from('social_profiles')
            .insert({ user_id: uid, ...profile }),
    );
    unwrap(
      await db()
        .from('social_settings')
        .upsert({ user_id: uid, ...s.settings }),
    );
    unwrap(
      await db().from('consents').insert({
        user_id: uid,
        consent_type: 'social',
        granted: true,
        document_version: legalVersion(),
      }),
    );
    unwrap(await db().from('user_preferences').update({ social_enabled: true }).eq('user_id', uid));
  });

export const useUpdateSocialProfile = () =>
  useSocialMutation<
    Pick<
      TablesUpdate<'social_profiles'>,
      'handle' | 'display_name' | 'avatar_color' | 'bio' | 'discoverable'
    >
  >(async (uid, values) => {
    unwrap(await db().from('social_profiles').update(values).eq('user_id', uid));
  });

export const useUpdateSocialSettings = () =>
  useSocialMutation<SocialSetup['settings']>(async (uid, values) => {
    unwrap(await db().from('social_settings').update(values).eq('user_id', uid));
  });

/** Switches social on (profile exists) or off (keeps profile and friends; records the revoke). */
export const useSetSocialEnabled = () =>
  useSocialMutation<boolean>(async (uid, on) => {
    unwrap(await db().from('user_preferences').update({ social_enabled: on }).eq('user_id', uid));
    unwrap(
      await db().from('consents').insert({
        user_id: uid,
        consent_type: 'social',
        granted: on,
        document_version: legalVersion(),
      }),
    );
  });

export const useDeleteSocialProfile = () =>
  useSocialMutation<void>(async (uid) => {
    unwrap(await db().rpc('delete_social_profile'));
    unwrap(
      await db().from('consents').insert({
        user_id: uid,
        consent_type: 'social',
        granted: false,
        document_version: legalVersion(),
      }),
    );
  });

// ---------------------------------------------------------------------------------------------
// Friends and safety
// ---------------------------------------------------------------------------------------------

export const useSendFriendRequest = () =>
  useSocialMutation<string, Relationship>(async (_uid, handle) =>
    relationship.parse(unwrap(await db().rpc('send_friend_request', { p_handle: handle }))),
  );

export const useAcceptFriendRequest = () =>
  useSocialMutation<string>(async (_uid, other) => {
    unwrap(await db().rpc('accept_friend_request', { other }));
  });

/** Declines, cancels or ends a friendship. */
export const useRemoveFriend = () =>
  useSocialMutation<string>(async (_uid, other) => {
    unwrap(await db().rpc('remove_friend', { other }));
  });

export const useBlockUser = () =>
  useSocialMutation<string>(async (_uid, other) => {
    unwrap(await db().rpc('block_user', { other }));
  });

export const useUnblockUser = () =>
  useSocialMutation<string>(async (_uid, other) => {
    unwrap(await db().rpc('unblock_user', { other }));
  });

export type ReportReason = 'spam' | 'harassment' | 'inappropriate' | 'other';

export const useReport = () =>
  useSocialMutation<{
    targetType: 'profile' | 'feed_item' | 'comment' | 'club';
    targetId: string;
    reason: ReportReason;
    note?: string;
  }>(async (_uid, r) => {
    unwrap(
      await db().rpc('report_content', {
        p_target_type: r.targetType,
        p_target_id: r.targetId,
        p_reason: r.reason,
        p_note: r.note ?? '',
      }),
    );
  });

// ---------------------------------------------------------------------------------------------
// Feed, cheers and comments (spec 33, Phase 8B)
// ---------------------------------------------------------------------------------------------

const feedRow = z.object({
  id: z.string(),
  owner: z.string(),
  handle: z.string(),
  display_name: z.string(),
  avatar_color: z.string(),
  kind: z.string(),
  snapshot: z.record(z.string(), z.unknown()),
  local_date: z.string(),
  created_at: z.string(),
  cheers: z.record(z.string(), z.number()),
  my_cheer: z.string().nullable(),
  comment_count: z.number(),
  is_mine: z.boolean(),
});
export type FeedRow = z.infer<typeof feedRow>;

const commentRow = z.object({
  id: z.string(),
  author: z.string(),
  handle: z.string(),
  display_name: z.string(),
  avatar_color: z.string(),
  body: z.string().nullable(),
  created_at: z.string(),
  removed: z.boolean(),
  can_delete: z.boolean(),
});
export type CommentRow = z.infer<typeof commentRow>;

export const FEED_PAGE = 20;

/** The feed, newest first, a page at a time (cursor = created_at of the last row). */
export function useFeed(owner: string | null = null, enabled = true) {
  const uid = useUid();
  return useInfiniteQuery({
    queryKey: socialKeys.feed(uid ?? 'anonymous', owner),
    enabled: !!uid && enabled,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) =>
      z.array(feedRow).parse(
        unwrap(
          await db().rpc('get_feed', {
            p_before: pageParam ?? undefined,
            p_max: FEED_PAGE,
            p_owner: owner ?? undefined,
          }),
        ),
      ),
    getNextPageParam: (last) =>
      last.length === FEED_PAGE ? (last[last.length - 1]?.created_at ?? null) : null,
  });
}

export const useFeedItem = (id: string) =>
  useSocialQuery(
    (uid) => socialKeys.item(uid, id),
    async () => {
      const rows = z.array(feedRow).parse(unwrap(await db().rpc('get_feed_item', { p_id: id })));
      return rows[0] ?? null;
    },
    !!id,
  );

export const useComments = (id: string) =>
  useSocialQuery(
    (uid) => socialKeys.comments(uid, id),
    async () => z.array(commentRow).parse(unwrap(await db().rpc('list_comments', { p_item: id }))),
    !!id,
  );

type FeedPages = InfiniteData<FeedRow[], string | null>;

/** Applies a change to one item wherever it is cached (feeds and the item screen). */
function patchItem(
  qc: ReturnType<typeof useQueryClient>,
  uid: string,
  id: string,
  change: (row: FeedRow) => FeedRow,
) {
  qc.setQueriesData<FeedPages>({ queryKey: ['social', uid, 'feed'] }, (old) =>
    old
      ? { ...old, pages: old.pages.map((p) => p.map((r) => (r.id === id ? change(r) : r))) }
      : old,
  );
  qc.setQueryData<FeedRow | null>(socialKeys.item(uid, id), (old) => (old ? change(old) : old));
}

const withCheer = (row: FeedRow, kind: string | null): FeedRow => {
  const cheers = { ...row.cheers };
  if (row.my_cheer) cheers[row.my_cheer] = Math.max(0, (cheers[row.my_cheer] ?? 1) - 1);
  if (kind) cheers[kind] = (cheers[kind] ?? 0) + 1;
  for (const k of Object.keys(cheers)) if (!cheers[k]) delete cheers[k];
  return { ...row, cheers, my_cheer: kind };
};

/** Cheer (or change / remove your cheer); shown at once and rolled back if it fails. */
export function useCheer() {
  const uid = useUid();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ row, kind }: { row: FeedRow; kind: string | null }) => {
      if (!onlineManager.isOnline()) throw new SocialError('network');
      if (kind) unwrap(await db().rpc('set_cheer', { p_item: row.id, p_kind: kind }));
      else unwrap(await db().rpc('remove_cheer', { p_item: row.id }));
    },
    onMutate: ({ row, kind }) => {
      if (uid) patchItem(qc, uid, row.id, (r) => withCheer(r, kind));
      return { before: row };
    },
    onError: (_e, { row }, ctx) => {
      if (uid && ctx) patchItem(qc, uid, row.id, () => ctx.before);
    },
  });
}

export const useAddComment = () =>
  useSocialMutation<{ itemId: string; body: string }>(async (_uid, { itemId, body }) => {
    unwrap(await db().rpc('add_comment', { p_item: itemId, p_body: body }));
  });

export const useDeleteComment = () =>
  useSocialMutation<string>(async (_uid, id) => {
    unwrap(await db().rpc('delete_comment', { p_id: id }));
  });

export const useHideFeedItem = () =>
  useSocialMutation<string>(async (_uid, id) => {
    unwrap(await db().rpc('hide_feed_item', { p_id: id }));
  });

/** Hides all your visible posts of one kind (sharing switched off); returns how many. */
export const useHideMyPosts = () =>
  useSocialMutation<string, number>(async (_uid, kind) =>
    z.number().parse(unwrap(await db().rpc('hide_my_posts', { p_kind: kind }))),
  );

/** Shows again the posts of one kind that switching sharing off hid; returns how many. */
export const useShowMyPosts = () =>
  useSocialMutation<string, number>(async (_uid, kind) =>
    z.number().parse(unwrap(await db().rpc('show_my_posts', { p_kind: kind }))),
  );

export async function hiddenPostCount(kind: string): Promise<number> {
  const { data, error } = await db().rpc('hidden_post_count', { p_kind: kind });
  if (error) fail(error);
  return typeof data === 'number' ? data : 0;
}

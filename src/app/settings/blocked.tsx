import { ErrorState, EmptyState, LoadingState, useToast } from '@/components/feedback';
import { Button, Screen } from '@/components/ui';
import { SOCIAL_ERRORS } from '@/domain/social';
import { errorCode, useBlocked, useOnline, useUnblockUser } from '@/features/social/api';
import { PersonRow } from '@/features/social/components/PersonRow';

/** People you blocked, with Unblock (spec 33.5). */
export default function BlockedPeople() {
  const list = useBlocked();
  const unblock = useUnblockUser();
  const online = useOnline();
  const showToast = useToast((s) => s.show);

  if (list.isPending)
    return (
      <Screen edges={['bottom']}>
        <LoadingState />
      </Screen>
    );
  if (list.isError)
    return (
      <Screen edges={['bottom']}>
        <ErrorState
          message="Couldn’t load the people you blocked."
          onRetry={() => void list.refetch()}
        />
      </Screen>
    );
  if (list.data.length === 0)
    return (
      <Screen edges={['bottom']}>
        <EmptyState
          title="No one blocked"
          message="People you block can’t find you, see you or send you requests."
        />
      </Screen>
    );
  return (
    <Screen edges={['bottom']}>
      {list.data.map((b) => (
        <PersonRow
          key={b.user_id}
          name={b.display_name ?? 'Deleted profile'}
          handle={b.handle ?? '—'}
          color={b.avatar_color ?? 'slate'}
          actions={
            <Button
              title="Unblock"
              variant="secondary"
              fullWidth={false}
              disabled={!online}
              loading={unblock.isPending && unblock.variables === b.user_id}
              onPress={() =>
                unblock.mutate(b.user_id, {
                  onSuccess: () => showToast('Unblocked'),
                  onError: (e) => showToast(SOCIAL_ERRORS[errorCode(e)]),
                })
              }
              accessibilityLabel={`Unblock ${b.display_name ?? 'this person'}`}
            />
          }
        />
      ))}
    </Screen>
  );
}

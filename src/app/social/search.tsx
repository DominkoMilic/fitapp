import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { EmptyState, ErrorState, Skeleton, useToast } from '@/components/feedback';
import { Button, Screen, Text, TextField } from '@/components/ui';
import { normaliseHandle, RELATIONSHIP_LABEL, SOCIAL_ERRORS } from '@/domain/social';
import {
  errorCode,
  useOnline,
  useProfileSearch,
  useSendFriendRequest,
} from '@/features/social/api';
import { OfflineNote } from '@/features/social/components/OfflineNote';
import { PersonRow } from '@/features/social/components/PersonRow';
import { spacing } from '@/theme';

const DEBOUNCE_MS = 350;

/** Find people by handle (spec 33.5). At least 3 characters; no contact upload. */
export default function SearchPeople() {
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  const online = useOnline();
  const search = useProfileSearch(q);
  const send = useSendFriendRequest();
  const showToast = useToast((s) => s.show);
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(
      () => setQ(normaliseHandle(text).replace(/[^a-z0-9_.]/g, '')),
      DEBOUNCE_MS,
    );
    return () => clearTimeout(t);
  }, [text]);

  const add = (handle: string, name: string) => {
    setPending(handle);
    send.mutate(handle, {
      onSuccess: (rel) =>
        showToast(rel === 'friends' ? `You and ${name} are friends` : `Request sent to ${name}`),
      onError: (e) => showToast(SOCIAL_ERRORS[errorCode(e)]),
      onSettled: () => setPending(null),
    });
  };

  return (
    <Screen edges={['bottom']}>
      {!online ? <OfflineNote /> : null}
      <TextField
        label="Handle"
        placeholder="@handle"
        value={text}
        onChangeText={setText}
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus
        returnKeyType="search"
        onSubmitEditing={() => setQ(normaliseHandle(text))}
      />
      {q.length < 3 ? (
        <Text variant="small" color="textSecondary">
          Type at least 3 characters of their handle. Ask a friend for theirs, or send them an
          invite from the Social tab.
        </Text>
      ) : search.isPending ? (
        <View style={styles.list}>
          <Skeleton height={56} />
          <Skeleton height={56} />
        </View>
      ) : search.isError ? (
        <ErrorState
          message={SOCIAL_ERRORS[errorCode(search.error)]}
          onRetry={() => void search.refetch()}
        />
      ) : (search.data ?? []).length === 0 ? (
        <EmptyState
          title="No one found"
          message={`No one with a handle starting “${q}”. Check the spelling, or invite them.`}
        />
      ) : (
        <View style={styles.list}>
          {search.data!.map((r) => (
            <PersonRow
              key={r.handle}
              name={r.display_name}
              handle={r.handle}
              color={r.avatar_color}
              detail={RELATIONSHIP_LABEL[r.relationship] || undefined}
              onPress={() =>
                router.push({ pathname: '/social/user/[handle]', params: { handle: r.handle } })
              }
              actions={
                r.relationship === 'none' || r.relationship === 'incoming' ? (
                  <Button
                    title={r.relationship === 'incoming' ? 'Accept' : 'Add'}
                    fullWidth={false}
                    disabled={!online}
                    loading={pending === r.handle}
                    onPress={() => add(r.handle, r.display_name)}
                    accessibilityLabel={`Add ${r.display_name}`}
                  />
                ) : undefined
              }
            />
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({ list: { gap: spacing.xs } });

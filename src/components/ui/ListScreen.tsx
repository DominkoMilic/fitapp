import { type ReactElement, type ReactNode, useContext, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import {
  KeyboardAvoidingView,
  useReanimatedKeyboardAnimation,
} from 'react-native-keyboard-controller';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { type Edge, SafeAreaInsetsContext, SafeAreaView } from 'react-native-safe-area-context';

import { spacing, useTheme } from '@/theme';

import { Button } from './Button';
import { Text } from './Text';

/** Rows shown per page in long lists. */
export const PAGE_SIZE = 20;

/**
 * Screen whose main content is a long list (spec 26 Phase 7: list virtualisation). Only the rows
 * on screen are rendered, so years of history stay fast. Everything above the list goes in `header`.
 * Rows come in pages of `pageSize`: the next page loads when scrolling near the end, and a
 * "Showing 20 of 134 · Show more" footer does the same on a tap. Lists paged by the server pass
 * `onLoadMore` (called at the end once every loaded row is shown) and `onRefresh` (pull to refresh).
 */
export function ListScreen<T>({
  data,
  renderItem,
  keyExtractor,
  header,
  empty,
  footer,
  overlay,
  edges = ['bottom'],
  pageSize = PAGE_SIZE,
  onLoadMore,
  loadingMore = false,
  onRefresh,
  refreshing = false,
}: {
  data: readonly T[];
  renderItem: (item: T, index: number) => ReactElement | null;
  keyExtractor: (item: T) => string;
  header?: ReactNode;
  empty?: ReactElement | null;
  footer?: ReactNode;
  /** Dialogs and other overlays rendered alongside the list. */
  overlay?: ReactNode;
  edges?: Edge[];
  pageSize?: number;
  /** Fetches the next server page; called at the end when every loaded row is shown. */
  onLoadMore?: () => void;
  loadingMore?: boolean;
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  const { colors } = useTheme();
  // Context (not the hook) so lists rendered without a provider (tests) still work.
  const bottomInset = useContext(SafeAreaInsetsContext)?.bottom ?? 0;
  const [shown, setShown] = useState(pageSize);
  const visible = data.length > shown ? data.slice(0, shown) : data;
  const more = data.length > visible.length;
  const nextPage = () => {
    if (more) setShown((n) => n + pageSize);
    else if (onLoadMore && !loadingMore) onLoadMore();
  };
  const list = (
    <FlatList
      data={visible}
      keyExtractor={keyExtractor}
      renderItem={({ item, index }) => renderItem(item, index)}
      ListHeaderComponent={header ? <View style={styles.header}>{header}</View> : undefined}
      ListEmptyComponent={empty ?? undefined}
      onEndReached={nextPage}
      onEndReachedThreshold={0.5}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        ) : undefined
      }
      ListFooterComponent={
        loadingMore ? (
          <View style={styles.more} accessibilityLabel="Loading more">
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : more ? (
          <View style={styles.more}>
            <Text variant="small" color="textSecondary">
              Showing {visible.length} of {data.length}
            </Text>
            <Button title="Show more" variant="ghost" fullWidth={false} onPress={nextPage} />
          </View>
        ) : undefined
      }
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      initialNumToRender={15}
      maxToRenderPerBatch={20}
      windowSize={9}
      removeClippedSubviews={Platform.OS === 'android'}
    />
  );
  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.background }]} edges={edges}>
      {footer ? (
        // A footer (e.g. a comment box) sits directly on the keyboard: the spacer below it grows
        // with the keyboard, so the list shrinks and what is typed stays visible.
        <>
          {list}
          <View style={[styles.footer, { borderTopColor: colors.border }]}>{footer}</View>
          <KeyboardSpacer bottomInset={edges.includes('bottom') ? bottomInset : 0} />
        </>
      ) : (
        // Works on Android too (edge-to-edge windows no longer resize for the keyboard).
        <KeyboardAvoidingView style={styles.flex} behavior="padding">
          {list}
        </KeyboardAvoidingView>
      )}
      {overlay}
    </SafeAreaView>
  );
}

/** Takes the keyboard's height minus the bottom safe area it covers. */
function KeyboardSpacer({ bottomInset }: { bottomInset: number }) {
  const { height } = useReanimatedKeyboardAnimation();
  const style = useAnimatedStyle(() => ({
    height: Math.max(0, -height.get() - bottomInset),
  }));
  return <Animated.View style={style} />;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: spacing.md, flexGrow: 1 },
  header: { gap: spacing.md, marginBottom: spacing.md },
  more: { alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.md },
  footer: { padding: spacing.md, gap: spacing.xs, borderTopWidth: StyleSheet.hairlineWidth },
});

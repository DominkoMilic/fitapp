import { type ReactElement, type ReactNode, useState } from 'react';
import { FlatList, Platform, StyleSheet, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { type Edge, SafeAreaView } from 'react-native-safe-area-context';

import { spacing, useTheme } from '@/theme';

import { Button } from './Button';
import { Text } from './Text';

/** Rows shown per page in long lists. */
export const PAGE_SIZE = 20;

/**
 * Screen whose main content is a long list (spec 26 Phase 7: list virtualisation). Only the rows
 * on screen are rendered, so years of history stay fast. Everything above the list goes in `header`.
 * Rows come in pages of `pageSize`: the next page loads when scrolling near the end, and a
 * "Showing 20 of 134 · Show more" footer does the same on a tap.
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
}) {
  const { colors } = useTheme();
  const [shown, setShown] = useState(pageSize);
  const visible = data.length > shown ? data.slice(0, shown) : data;
  const more = data.length > visible.length;
  const nextPage = () => {
    if (more) setShown((n) => n + pageSize);
  };
  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.background }]} edges={edges}>
      {/* Works on Android too (edge-to-edge windows no longer resize for the keyboard). */}
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        <FlatList
          data={visible}
          keyExtractor={keyExtractor}
          renderItem={({ item, index }) => renderItem(item, index)}
          ListHeaderComponent={header ? <View style={styles.header}>{header}</View> : undefined}
          ListEmptyComponent={empty ?? undefined}
          onEndReached={nextPage}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            more ? (
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
        {footer ? (
          <View style={[styles.footer, { borderTopColor: colors.border }]}>{footer}</View>
        ) : null}
        {overlay}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: spacing.md, flexGrow: 1 },
  header: { gap: spacing.md, marginBottom: spacing.md },
  more: { alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.md },
  footer: { padding: spacing.md, gap: spacing.xs, borderTopWidth: StyleSheet.hairlineWidth },
});

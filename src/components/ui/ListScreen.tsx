import type { ReactElement, ReactNode } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { type Edge, SafeAreaView } from 'react-native-safe-area-context';

import { spacing, useTheme } from '@/theme';

/**
 * Screen whose main content is a long list (spec 26 Phase 7: list virtualisation). Only the rows
 * on screen are rendered, so years of history stay fast. Everything above the list goes in `header`.
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
}) {
  const { colors } = useTheme();
  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.background }]} edges={edges}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <FlatList
          data={data}
          keyExtractor={keyExtractor}
          renderItem={({ item, index }) => renderItem(item, index)}
          ListHeaderComponent={header ? <View style={styles.header}>{header}</View> : undefined}
          ListEmptyComponent={empty ?? undefined}
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
  footer: { padding: spacing.md, gap: spacing.xs, borderTopWidth: StyleSheet.hairlineWidth },
});

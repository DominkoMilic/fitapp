import { type PropsWithChildren } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { type Edge, SafeAreaView } from 'react-native-safe-area-context';

import { spacing, useTheme } from '@/theme';

/** Standard screen container: safe areas, theme background, optional scroll and keyboard handling. */
export function Screen({
  children,
  scroll = true,
  edges = ['top', 'bottom'],
  footer,
}: PropsWithChildren<{ scroll?: boolean; edges?: Edge[]; footer?: React.ReactNode }>) {
  const { colors } = useTheme();
  const body = scroll ? (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.content, styles.flex]}>{children}</View>
  );
  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.background }]} edges={edges}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {body}
        {footer ? (
          <View style={[styles.footer, { borderTopColor: colors.border }]}>{footer}</View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: spacing.md, gap: spacing.md, flexGrow: 1 },
  footer: { padding: spacing.md, gap: spacing.xs, borderTopWidth: StyleSheet.hairlineWidth },
});

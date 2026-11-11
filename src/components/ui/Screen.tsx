import { type PropsWithChildren, useContext, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  KeyboardAvoidingView,
  KeyboardAwareScrollView,
  type KeyboardAwareScrollViewRef,
  KeyboardStickyView,
} from 'react-native-keyboard-controller';
import { type Edge, SafeAreaInsetsContext, SafeAreaView } from 'react-native-safe-area-context';

import { spacing, useTheme } from '@/theme';

import { FormLock } from './FormLock';

/** Space kept between the focused field and the keyboard (or the footer above it). */
const FIELD_GAP = spacing.lg;

/**
 * The scroll offset to move to after the content changed height, or null when the current one
 * is still valid. Content that shrinks while scrolled down (e.g. a section hidden by a setting)
 * would otherwise leave a blank area until the user scrolls. Pure.
 */
export function clampOffset(offset: number, contentHeight: number, viewportHeight: number) {
  const max = Math.max(0, contentHeight - viewportHeight);
  return offset > max + 1 ? max : null;
}

/**
 * Standard screen container: safe areas, theme background, scroll and keyboard handling.
 *
 * The focused field is always scrolled above the keyboard (on Android too: edge-to-edge
 * windows no longer resize for the keyboard), and the footer rides on top of the keyboard so
 * Save/Continue stays reachable.
 */
export function Screen({
  children,
  scroll = true,
  edges = ['top', 'bottom'],
  footer,
  locked,
}: PropsWithChildren<{
  scroll?: boolean;
  edges?: Edge[];
  footer?: React.ReactNode;
  /** While saving: the content (not the footer with the Save button) can't be edited. */
  locked?: boolean;
}>) {
  const { colors } = useTheme();
  // Context (not the hook) so screens rendered without a provider (tests) still work.
  const insets = useContext(SafeAreaInsetsContext);
  const [footerHeight, setFooterHeight] = useState(0);
  const scrollRef = useRef<KeyboardAwareScrollViewRef>(null);
  const offset = useRef(0);
  const viewport = useRef(0);
  // The footer sits above the bottom safe area; when the keyboard opens, that inset is covered
  // by the keyboard, so the footer moves down by it to sit right on the keyboard.
  const bottomInset = edges.includes('bottom') ? (insets?.bottom ?? 0) : 0;

  const content =
    locked === undefined ? (
      children
    ) : (
      <FormLock locked={locked} style={styles.grow}>
        {children}
      </FormLock>
    );
  const body = scroll ? (
    <KeyboardAwareScrollView
      ref={scrollRef}
      onLayout={(e) => {
        viewport.current = e.nativeEvent.layout.height;
      }}
      onScroll={(e) => {
        offset.current = e.nativeEvent.contentOffset.y;
      }}
      scrollEventThrottle={16}
      onContentSizeChange={(_, contentHeight) => {
        const to = clampOffset(offset.current, contentHeight, viewport.current);
        if (to !== null) scrollRef.current?.scrollTo({ y: to, animated: true });
      }}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      bottomOffset={FIELD_GAP + (footer ? footerHeight - bottomInset : 0)}
    >
      {content}
    </KeyboardAwareScrollView>
  ) : (
    <KeyboardAvoidingView behavior="padding" style={[styles.content, styles.flex]}>
      {content}
    </KeyboardAvoidingView>
  );
  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.background }]} edges={edges}>
      {body}
      {footer ? (
        <KeyboardStickyView offset={{ closed: 0, opened: bottomInset }}>
          <View
            onLayout={(e) => setFooterHeight(e.nativeEvent.layout.height)}
            style={[
              styles.footer,
              { borderTopColor: colors.border, backgroundColor: colors.background },
            ]}
          >
            {footer}
          </View>
        </KeyboardStickyView>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  grow: { flexGrow: 1 },
  content: { padding: spacing.md, gap: spacing.md, flexGrow: 1 },
  footer: { padding: spacing.md, gap: spacing.xs, borderTopWidth: StyleSheet.hairlineWidth },
});

import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';

import { Text } from '@/components/ui/Text';
import { radius, spacing, useTheme } from '@/theme';

interface ToastState {
  message: string | null;
  actionLabel: string | null;
  onAction: (() => void) | null;
  key: number;
  show: (message: string, action?: { label: string; onPress: () => void }) => void;
  hide: () => void;
}

export const useToast = create<ToastState>((set) => ({
  message: null,
  actionLabel: null,
  onAction: null,
  key: 0,
  show: (message, action) => {
    set((s) => ({
      message,
      actionLabel: action?.label ?? null,
      onAction: action?.onPress ?? null,
      key: s.key + 1,
    }));
  },
  hide: () => {
    set({ message: null, actionLabel: null, onAction: null });
  },
}));

const DURATION_MS = 5000;

/** Single toast host, mounted once at the root. Supports one action (e.g. Undo, spec 6.3). */
export function ToastHost() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { message, actionLabel, onAction, key, hide } = useToast();

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(hide, DURATION_MS);
    return () => clearTimeout(t);
  }, [message, key, hide]);

  if (!message) return null;
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: insets.bottom + 72 }]}>
      <View
        accessibilityLiveRegion="polite"
        accessibilityRole="alert"
        style={[
          styles.toast,
          { backgroundColor: colors.surfaceRaised, borderColor: colors.border },
        ]}
      >
        <Text variant="small" style={styles.text}>
          {message}
        </Text>
        {actionLabel && onAction ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={actionLabel}
            hitSlop={12}
            onPress={() => {
              onAction();
              hide();
            }}
          >
            <Text variant="bodyStrong" color="accent">
              {actionLabel}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: spacing.md, right: spacing.md, alignItems: 'center' },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.card,
    borderWidth: 1,
    maxWidth: 480,
    width: '100%',
  },
  text: { flex: 1 },
});

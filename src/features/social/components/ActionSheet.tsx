import { useContext } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

import { Button, Text } from '@/components/ui';
import { ModalShell } from '@/components/ui/ModalShell';
import { motion, radius, spacing, useTheme } from '@/theme';

export interface SheetAction {
  label: string;
  destructive?: boolean;
  onPress: () => void;
}

/** A short list of actions sliding up from the bottom (the ⋯ menus). */
export function ActionSheet({
  visible,
  title,
  actions,
  onClose,
}: {
  visible: boolean;
  title: string;
  actions: readonly SheetAction[];
  onClose: () => void;
}) {
  const { colors, reduceMotion } = useTheme();
  // Context (not the hook) so the sheet also renders without a provider (tests).
  const bottomInset = useContext(SafeAreaInsetsContext)?.bottom ?? 0;
  return (
    <ModalShell visible={visible} onRequestClose={onClose}>
      <View style={styles.fill}>
        <Animated.View
          entering={reduceMotion ? undefined : FadeIn.duration(motion.normal)}
          style={StyleSheet.absoluteFill}
        >
          <Pressable
            style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }]}
            onPress={onClose}
            accessibilityLabel="Dismiss"
            accessibilityRole="button"
          />
        </Animated.View>
        <Animated.View
          entering={reduceMotion ? undefined : SlideInDown.duration(motion.normal)}
          accessibilityViewIsModal
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              paddingBottom: bottomInset + spacing.md,
            },
          ]}
        >
          <Text variant="title" accessibilityRole="header">
            {title}
          </Text>
          {actions.map((a) => (
            <Button
              key={a.label}
              title={a.label}
              variant={a.destructive ? 'destructive' : 'secondary'}
              onPress={() => {
                onClose();
                a.onPress();
              }}
            />
          ))}
          <Button title="Cancel" variant="ghost" onPress={onClose} />
        </Animated.View>
      </View>
    </ModalShell>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    borderWidth: 1,
    padding: spacing.xl,
    gap: spacing.xs,
  },
});

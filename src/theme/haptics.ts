/**
 * Subtle haptics (spec 23.4). Light ticks for selections, a soft tap for primary actions and a
 * success pulse after saving. No-ops on web and when "reduce motion" is on; errors are ignored
 * (devices without a vibrator, battery saver, etc.).
 */
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

let enabled = true;
/** Kept in line with the OS reduce-motion setting by ThemeProvider. */
export const setHapticsEnabled = (on: boolean) => {
  enabled = on;
};

const run = (fn: () => Promise<void>) => {
  if (!enabled || Platform.OS === 'web') return;
  void fn().catch(() => undefined);
};

export const haptics = {
  selection: () => run(() => Haptics.selectionAsync()),
  light: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  success: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
};

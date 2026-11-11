import type { Href } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { Pressable, StyleSheet } from 'react-native';

import { TOUCH_TARGET, useTheme } from '@/theme';

import { goBack } from './back';

/**
 * Back arrow for the first screen of a nested stack. A native header only shows its own arrow
 * when that stack has an earlier screen, so a screen opened straight from a tab, a card or a link
 * (e.g. Record activity from Training → +) had no way back. Goes back when there is history,
 * otherwise to `fallback`.
 */
export function HeaderBack({ fallback }: { fallback: Href }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Back"
      hitSlop={8}
      onPress={() => goBack(fallback)}
      style={styles.button}
    >
      <ArrowLeft size={24} color={colors.textPrimary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: TOUCH_TARGET,
    height: TOUCH_TARGET,
    alignItems: 'flex-start',
    justifyContent: 'center',
    marginRight: 8,
  },
});

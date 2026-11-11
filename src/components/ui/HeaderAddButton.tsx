import { Plus } from 'lucide-react-native';
import { StyleSheet } from 'react-native';

import { radius, TOUCH_TARGET, useTheme } from '@/theme';

import { PressableScale } from './PressableScale';

/** The round accent "+" next to a tab's title (Training: add training, Progress: log weight). */
export function HeaderAddButton({
  accessibilityLabel,
  onPress,
}: {
  accessibilityLabel: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={[styles.button, { backgroundColor: colors.accent }]}
    >
      <Plus size={24} color={colors.onAccent} strokeWidth={2.5} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  button: {
    width: TOUCH_TARGET,
    height: TOUCH_TARGET,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

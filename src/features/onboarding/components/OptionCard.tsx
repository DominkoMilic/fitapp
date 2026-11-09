import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { radius, spacing, TOUCH_TARGET, useTheme } from '@/theme';

/** Single-choice card (radio) with a title and description. */
export function OptionCard({
  title,
  description,
  selected,
  onPress,
}: {
  title: string;
  description?: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={description ? `${title}. ${description}` : title}
      onPress={onPress}
      style={[
        styles.card,
        { borderColor: selected ? colors.accent : colors.border, backgroundColor: colors.surface },
      ]}
    >
      <View style={[styles.dot, { borderColor: selected ? colors.accent : colors.border }]}>
        {selected ? <View style={[styles.inner, { backgroundColor: colors.accent }]} /> : null}
      </View>
      <View style={styles.text}>
        <Text variant="bodyStrong">{title}</Text>
        {description ? (
          <Text variant="small" color="textSecondary">
            {description}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: TOUCH_TARGET + 8,
    padding: spacing.sm,
    borderWidth: 1.5,
    borderRadius: radius.card,
  },
  dot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inner: { width: 12, height: 12, borderRadius: 6 },
  text: { flex: 1, gap: 2 },
});

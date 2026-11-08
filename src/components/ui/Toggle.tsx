import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { spacing, TOUCH_TARGET, useTheme } from '@/theme';

import { Text } from './Text';

export function Toggle({
  label,
  description,
  value,
  onChange,
  error,
}: {
  label: string;
  description?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  error?: string;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}
      accessibilityHint={description}
      onPress={() => onChange(!value)}
      style={styles.row}
    >
      <View style={styles.text}>
        <Text variant="body">{label}</Text>
        {description ? (
          <Text variant="small" color="textSecondary">
            {description}
          </Text>
        ) : null}
        {error ? (
          <Text variant="small" color="danger" accessibilityRole="alert">
            {error}
          </Text>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: colors.accent, false: colors.border }}
        thumbColor="#FFFFFF"
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', minHeight: TOUCH_TARGET, gap: spacing.sm },
  text: { flex: 1, gap: 2 },
});

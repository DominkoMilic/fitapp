import { StyleSheet, View } from 'react-native';

import { radius, spacing, useTheme } from '@/theme';

import { Text } from './Text';

/** A small pill naming a state ("In progress", "Edited"), so it isn't told by colour alone. */
export function StatusTag({
  label,
  tone = 'accent',
}: {
  label: string;
  tone?: 'accent' | 'warning' | 'muted';
}) {
  const { colors } = useTheme();
  const fg =
    tone === 'warning' ? colors.warning : tone === 'muted' ? colors.textSecondary : colors.accent;
  const bg =
    tone === 'warning'
      ? colors.warningSurface
      : tone === 'muted'
        ? colors.surfaceRaised
        : colors.successSurface;
  return (
    <View style={[styles.tag, { backgroundColor: bg, borderColor: fg }]}>
      <Text variant="caption" style={[styles.text, { color: fg }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: {
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
  },
  text: { fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
});

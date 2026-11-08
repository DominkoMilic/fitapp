import { StyleSheet, View } from 'react-native';

import { spacing } from '@/theme';

import { Text } from './Text';

export function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <Text variant="title" accessibilityRole="header">
        {title}
      </Text>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
});

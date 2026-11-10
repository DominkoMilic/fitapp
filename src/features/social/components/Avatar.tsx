import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { avatarHex, initials } from '@/domain/social';

/** A coloured circle with initials (social profiles have no photos in 8A). */
export function Avatar({ name, color, size = 40 }: { name: string; color: string; size?: number }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: avatarHex(color) },
      ]}
    >
      <Text variant={size >= 56 ? 'heading' : 'bodyStrong'} style={styles.text}>
        {initials(name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center' },
  // Dark text reads on every palette colour.
  text: { color: '#0B0D10' },
});

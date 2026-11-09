import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { spacing } from '@/theme';

import { Banner } from './Banner';

/**
 * Shown above content when loading failed (audit: screens had no error state). Whatever was
 * already loaded stays visible below; the user can retry.
 */
export function LoadErrorBanner({
  visible,
  what,
  onRetry,
}: {
  visible: boolean;
  /** e.g. "your plan" → "Your plan couldn't be loaded." */
  what: string;
  onRetry: () => void;
}) {
  if (!visible) return null;
  return (
    <View style={styles.wrap}>
      <Banner
        tone="warning"
        message={`${what.charAt(0).toUpperCase()}${what.slice(1)} couldn't be loaded. Check your connection.`}
      />
      <Button title="Try again" variant="secondary" fullWidth={false} onPress={onRetry} />
    </View>
  );
}

const styles = StyleSheet.create({ wrap: { gap: spacing.xs, alignItems: 'flex-start' } });

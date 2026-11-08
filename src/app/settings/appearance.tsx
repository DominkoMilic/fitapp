import { Screen, SegmentedControl, Text } from '@/components/ui';
import { type ThemePreference, useTheme } from '@/theme';

export default function Appearance() {
  const { preference, setPreference } = useTheme();
  return (
    <Screen edges={['bottom']}>
      <Text variant="small" color="textSecondary">
        Theme
      </Text>
      <SegmentedControl<ThemePreference>
        accessibilityLabel="Theme"
        options={[
          { value: 'system', label: 'System' },
          { value: 'dark', label: 'Dark' },
          { value: 'light', label: 'Light' },
        ]}
        value={preference}
        onChange={setPreference}
      />
      <Text variant="caption" color="textSecondary">
        Stored on this device only.
      </Text>
    </Screen>
  );
}

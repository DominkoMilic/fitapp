import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui';

/** Move up / Move down / Remove for one row of an editable list (accessible, no dragging). */
export function RowActions({
  label,
  first,
  last,
  onMove,
  onRemove,
}: {
  label: string;
  first: boolean;
  last: boolean;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}) {
  return (
    <View style={styles.actions}>
      <Button
        title="Move up"
        variant="ghost"
        fullWidth={false}
        disabled={first}
        accessibilityLabel={`Move ${label} up`}
        onPress={() => onMove(-1)}
      />
      <Button
        title="Move down"
        variant="ghost"
        fullWidth={false}
        disabled={last}
        accessibilityLabel={`Move ${label} down`}
        onPress={() => onMove(1)}
      />
      <Button
        title="Remove"
        variant="ghost"
        fullWidth={false}
        accessibilityLabel={`Remove ${label}`}
        onPress={onRemove}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', justifyContent: 'flex-end', flexWrap: 'wrap' },
});

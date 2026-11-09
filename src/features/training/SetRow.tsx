import { X } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button, NumberField, Text } from '@/components/ui';
import { KG_PER_LB } from '@/domain/calculations/units';
import type { ActiveSet } from '@/domain/training/active-workout';
import type { TrackingType } from '@/domain/training/catalogue';
import { radius, spacing, TOUCH_TARGET, useTheme } from '@/theme';

/**
 * One set: reps (and weight) or seconds, a done toggle, and an optional remove button
 * (spec 10.4). Used in the live workout, when logging a past workout and when editing one.
 */
export function SetRow({
  index,
  set,
  tracking,
  metric,
  onChange,
  onToggle,
  onRemove,
  onStartHold,
  holdRemainingS,
}: {
  index: number;
  set: ActiveSet;
  tracking: TrackingType;
  metric: boolean;
  onChange: (patch: Partial<ActiveSet>) => void;
  onToggle: () => void;
  /** Shown when the set may be removed. */
  onRemove?: () => void;
  /** Timed sets in a live workout: start a countdown for this hold. */
  onStartHold?: () => void;
  /** Seconds left in this set's running hold (null when none is running). */
  holdRemainingS?: number | null;
}) {
  const { colors } = useTheme();
  const n = index + 1;
  const toDisp = (kg: number | null) =>
    kg === null ? null : metric ? kg : Math.round((kg / KG_PER_LB) * 10) / 10;
  const fromDisp = (v: number | null) => (v === null ? null : metric ? v : v * KG_PER_LB);
  const holding = holdRemainingS !== null && holdRemainingS !== undefined;
  return (
    <View
      style={[
        styles.row,
        {
          borderColor: set.completed ? colors.accent : colors.border,
          backgroundColor: colors.surface,
        },
      ]}
    >
      <Text variant="bodyStrong" style={styles.no}>
        {n}
      </Text>
      {tracking === 'time' ? (
        <View style={styles.field}>
          <NumberField
            label={`Set ${n} seconds`}
            suffix="s"
            decimal={false}
            precision={0}
            value={set.durationS}
            onChangeValue={(v) => onChange({ durationS: v })}
          />
        </View>
      ) : (
        <>
          <View style={styles.field}>
            <NumberField
              label={`Set ${n} reps`}
              decimal={false}
              precision={0}
              value={set.reps}
              onChangeValue={(v) => onChange({ reps: v })}
            />
          </View>
          {tracking === 'reps_weight' ? (
            <View style={styles.field}>
              <NumberField
                label={`Set ${n} weight`}
                suffix={metric ? 'kg' : 'lb'}
                value={toDisp(set.weightKg)}
                onChangeValue={(v) => onChange({ weightKg: fromDisp(v) })}
              />
            </View>
          ) : null}
        </>
      )}
      <View style={styles.actions}>
        {onStartHold && !set.completed ? (
          <Button
            title={holding ? `${holdRemainingS} s` : 'Start'}
            variant="secondary"
            fullWidth={false}
            disabled={holding}
            accessibilityLabel={
              holding
                ? `${holdRemainingS} seconds left`
                : `Start a ${set.durationS ?? 0} second hold`
            }
            onPress={onStartHold}
          />
        ) : null}
        <Button
          title={set.completed ? '✓' : 'Done'}
          variant={set.completed ? 'primary' : 'secondary'}
          fullWidth={false}
          accessibilityLabel={`Set ${n} ${set.completed ? 'completed, tap to undo' : 'mark as done'}`}
          onPress={onToggle}
        />
        {onRemove ? (
          <Pressable
            onPress={onRemove}
            accessibilityRole="button"
            accessibilityLabel={`Remove set ${n}`}
            hitSlop={8}
            style={styles.remove}
          >
            <X size={18} color={colors.textSecondary} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.xs,
    padding: spacing.xs,
    borderWidth: 1.5,
    borderRadius: radius.card,
  },
  no: { width: 20, textAlign: 'center', marginBottom: spacing.sm },
  field: { flex: 1, minWidth: TOUCH_TARGET * 1.5 },
  // Line the buttons up with the input boxes, not the labels above them.
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.xxs, marginBottom: 2 },
  remove: {
    width: 32,
    height: TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

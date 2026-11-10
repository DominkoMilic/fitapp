import { StyleSheet, View } from 'react-native';

import { NumberField, SegmentedControl, Text, TextField } from '@/components/ui';
import { addDays, type IsoDate } from '@/domain/calculations/dates';
import { formatShortDate } from '@/domain/format';
import { DateField } from '@/features/onboarding/components/DateField';
import { spacing } from '@/theme';

export interface TimingValue {
  date: IsoDate;
  startTime: string;
  durationMinutes: number | null;
}

/**
 * When a workout happened and how long it took (spec 10.4): today, yesterday or an earlier
 * date, a start time and minutes. Used for workouts done without the phone, and to correct the
 * timer.
 */
export function TimingFields({
  value,
  onChange,
  today,
  error,
  showDate = true,
}: {
  value: TimingValue;
  onChange: (v: TimingValue) => void;
  today: IsoDate;
  error?: string | null;
  showDate?: boolean;
}) {
  const yesterday = addDays(today, -1);
  const day = value.date === today ? 'today' : value.date === yesterday ? 'yesterday' : 'earlier';
  return (
    <View style={styles.stack}>
      {showDate ? (
        <>
          <SegmentedControl
            accessibilityLabel="Day"
            options={[
              { value: 'today', label: 'Today' },
              { value: 'yesterday', label: 'Yesterday' },
              { value: 'earlier', label: 'Earlier' },
            ]}
            value={day}
            onChange={(v) =>
              onChange({
                ...value,
                date: v === 'today' ? today : v === 'yesterday' ? yesterday : addDays(today, -2),
              })
            }
          />
          {day === 'earlier' ? (
            <DateField
              key="earlier"
              label="Date"
              min={addDays(today, -60)}
              max={today}
              value={value.date}
              onChange={(iso) => iso && onChange({ ...value, date: iso })}
            />
          ) : null}
        </>
      ) : null}
      <View style={styles.row}>
        <View style={styles.flex}>
          <TextField
            label="Start time"
            placeholder="18:30"
            value={value.startTime}
            onChangeText={(startTime) => onChange({ ...value, startTime })}
            keyboardType="numbers-and-punctuation"
            maxLength={5}
          />
        </View>
        <View style={styles.flex}>
          <NumberField
            label="Duration"
            suffix="min"
            decimal={false}
            precision={0}
            value={value.durationMinutes}
            onChangeValue={(durationMinutes) => onChange({ ...value, durationMinutes })}
          />
        </View>
      </View>
      {error ? (
        <Text variant="small" color="danger" accessibilityRole="alert">
          {error}
        </Text>
      ) : showDate ? (
        <Text variant="caption" color="textSecondary">
          {formatShortDate(value.date)}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.xs },
  row: { flexDirection: 'row', gap: spacing.xs },
  flex: { flex: 1 },
});

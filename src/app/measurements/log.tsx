import { useState } from 'react';

import { goBack } from '@/navigation/back';
import { type FieldErrors, useFieldErrors } from '@/hooks/useFieldErrors';
import { Banner, useToast } from '@/components/feedback';
import { Button, NumberField, Screen, Text } from '@/components/ui';
import { CM_PER_IN, type UnitSystem } from '@/domain/calculations/units';
import {
  isValidMeasurement,
  MEASUREMENT_LABELS,
  MEASUREMENT_TYPES,
  type MeasurementType,
} from '@/domain/measurements/measurements';
import { useToday } from '@/features/dashboard/useToday';
import { useMeasurementActions } from '@/features/measurements/api';
import { DateField } from '@/features/onboarding/components/DateField';
import { useProfile } from '@/features/profile/api';
import { plural } from '@/domain/format';

export default function LogMeasurements() {
  const { today } = useToday();
  const { data: profile } = useProfile();
  const actions = useMeasurementActions();
  const showToast = useToast((s) => s.show);
  const unit = (profile?.unit_system ?? 'metric') as UnitSystem;
  const [date, setDate] = useState<string | null>(today);
  const [values, setValues] = useState<Partial<Record<MeasurementType, number | null>>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fields = useFieldErrors<MeasurementType | 'date'>();

  const toCm = (v: number) => (unit === 'metric' ? v : v * CM_PER_IN);

  const save = async () => {
    const entered = Object.entries(values).filter(
      (e): e is [MeasurementType, number] => typeof e[1] === 'number',
    );
    setError(null);
    const e: FieldErrors<MeasurementType | 'date'> = {};
    if (!date || date > today) e.date = 'Choose a date that is today or earlier';
    for (const [k, v] of entered)
      if (!isValidMeasurement(toCm(v)))
        e[k] = unit === 'metric' ? 'Must be between 10 and 250 cm' : 'Must be between 4 and 98 in';
    if (!fields.show(e)) return;
    // Not about one field: nothing was filled in at all.
    if (!entered.length) return setError('Enter at least one measurement');
    if (!date) return;
    setSaving(true);
    try {
      await actions.saveMany(date, Object.fromEntries(entered.map(([k, v]) => [k, toCm(v)])));
      goBack('/progress/measurements');
      showToast(`${plural(entered.length, 'measurement')} saved`);
    } catch {
      setError("Couldn't save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen
      edges={['bottom']}
      footer={<Button title="Save" loading={saving} onPress={() => void save()} />}
    >
      {error ? <Banner tone="danger" message={error} /> : null}
      <DateField
        max={today}
        label="Date"
        value={date}
        onChange={(v) => {
          setDate(v);
          fields.clear('date');
        }}
        error={fields.errors.date}
      />
      <Text variant="caption" color="textSecondary">
        Fill in only what you measured. Measure at the same time of day, relaxed, with the tape
        level and snug but not tight.
      </Text>
      {MEASUREMENT_TYPES.map((t) => (
        <NumberField
          key={t}
          label={MEASUREMENT_LABELS[t]}
          suffix={unit === 'metric' ? 'cm' : 'in'}
          value={values[t] ?? null}
          onChangeValue={(v) => {
            setValues({ ...values, [t]: v });
            fields.clear(t);
          }}
          error={fields.errors[t]}
        />
      ))}
    </Screen>
  );
}

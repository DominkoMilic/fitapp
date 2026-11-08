import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { NumberField } from '@/components/ui';
import {
  cmToFeetInches,
  feetInchesToCm,
  kgToLb,
  lbToKg,
  type UnitSystem,
} from '@/domain/calculations/units';
import { spacing } from '@/theme';

/** Height input in cm or ft + in. Always reports centimetres. */
export function HeightField({
  value,
  onChange,
  unitSystem,
  error,
}: {
  value: number | null;
  onChange: (cm: number | null) => void;
  unitSystem: UnitSystem;
  error?: string;
}) {
  const initial = value !== null ? cmToFeetInches(value) : { feet: null, inches: null };
  const [feet, setFeet] = useState<number | null>(initial.feet);
  const [inches, setInches] = useState<number | null>(initial.inches);

  if (unitSystem === 'metric') {
    return (
      <NumberField
        label="Height"
        suffix="cm"
        value={value}
        onChangeValue={onChange}
        error={error}
      />
    );
  }
  const emit = (f: number | null, i: number | null) => {
    setFeet(f);
    setInches(i);
    onChange(f !== null && i !== null && i < 12 ? feetInchesToCm(f, i) : null);
  };
  return (
    <View style={styles.row}>
      <View style={styles.flex}>
        <NumberField
          label="Height (feet)"
          suffix="ft"
          decimal={false}
          precision={0}
          value={feet}
          onChangeValue={(f) => emit(f, inches ?? 0)}
          error={error}
        />
      </View>
      <View style={styles.flex}>
        <NumberField
          label="Inches"
          suffix="in"
          value={inches}
          onChangeValue={(i) => emit(feet, i)}
        />
      </View>
    </View>
  );
}

/** Weight input in kg or lb. Always reports kilograms. */
export function WeightField({
  label,
  value,
  onChange,
  unitSystem,
  error,
  hint,
}: {
  label: string;
  value: number | null;
  onChange: (kg: number | null) => void;
  unitSystem: UnitSystem;
  error?: string;
  hint?: string;
}) {
  if (unitSystem === 'metric') {
    return (
      <NumberField
        label={label}
        suffix="kg"
        value={value}
        onChangeValue={onChange}
        error={error}
        hint={hint}
      />
    );
  }
  return (
    <NumberField
      label={label}
      suffix="lb"
      value={value === null ? null : Math.round(kgToLb(value) * 10) / 10}
      onChangeValue={(lb) => onChange(lb === null ? null : lbToKg(lb))}
      error={error}
      hint={hint}
    />
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.xs },
  flex: { flex: 1 },
});

import { useEffect, useState } from 'react';

import { parseDecimal } from '@/domain/calculations/units';

import { TextField, type TextFieldProps } from './TextField';

export interface NumberFieldProps extends Omit<
  TextFieldProps,
  'value' | 'onChangeText' | 'keyboardType'
> {
  value: number | null;
  onChangeValue: (value: number | null) => void;
  /** Allow decimals (accepts both "," and "."). */
  decimal?: boolean;
  /** Display precision when the value changes from outside. */
  precision?: number;
}

const format = (v: number | null, precision: number) =>
  v === null ? '' : String(Number(v.toFixed(precision)));

/** Unit-aware numeric input. Keeps the raw text while typing; reports null for invalid input. */
export function NumberField({
  value,
  onChangeValue,
  decimal = true,
  precision = 1,
  ...rest
}: NumberFieldProps) {
  const [text, setText] = useState(format(value, precision));

  useEffect(() => {
    const parsed = parseDecimal(text);
    if (parsed !== value) setText(format(value, precision));
    // Only resync when the external value changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <TextField
      {...rest}
      value={text}
      keyboardType={decimal ? 'decimal-pad' : 'number-pad'}
      inputMode={decimal ? 'decimal' : 'numeric'}
      onChangeText={(t) => {
        setText(t);
        const parsed = parseDecimal(t);
        onChangeValue(parsed !== null && (decimal || Number.isInteger(parsed)) ? parsed : null);
      }}
    />
  );
}

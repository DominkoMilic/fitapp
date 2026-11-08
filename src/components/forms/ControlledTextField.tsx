import { type Control, Controller, type FieldPath, type FieldValues } from 'react-hook-form';

import { TextField, type TextFieldProps } from '@/components/ui/TextField';

export function ControlledTextField<T extends FieldValues>({
  control,
  name,
  ...rest
}: { control: Control<T>; name: FieldPath<T> } & Omit<
  TextFieldProps,
  'value' | 'onChangeText' | 'onBlur'
>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <TextField
          {...rest}
          value={typeof field.value === 'string' ? field.value : ''}
          onChangeText={field.onChange}
          onBlur={field.onBlur}
          error={fieldState.error?.message}
        />
      )}
    />
  );
}

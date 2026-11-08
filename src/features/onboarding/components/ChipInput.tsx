import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Chip, TextField } from '@/components/ui';
import { spacing } from '@/theme';

/** Free-text list entry with optional suggestions (allergies, disliked foods, cuisines). */
export function ChipInput({
  label,
  values,
  onChange,
  suggestions = [],
  placeholder,
}: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  suggestions?: readonly string[];
  placeholder?: string;
}) {
  const [text, setText] = useState('');
  const add = (raw: string) => {
    const v = raw.trim().toLowerCase();
    if (!v || values.includes(v) || v.length > 40 || values.length >= 30) return;
    onChange([...values, v]);
    setText('');
  };
  const remaining = suggestions.filter((s) => !values.includes(s));
  return (
    <View style={styles.wrapper}>
      <TextField
        label={label}
        value={text}
        placeholder={placeholder ?? 'Type and press enter'}
        onChangeText={setText}
        onSubmitEditing={() => add(text)}
        returnKeyType="done"
        submitBehavior="submit"
      />
      {values.length ? (
        <View style={styles.chips}>
          {values.map((v) => (
            <Chip
              key={v}
              label={v}
              selected
              onRemove={() => onChange(values.filter((x) => x !== v))}
            />
          ))}
        </View>
      ) : null}
      {remaining.length ? (
        <View style={styles.chips}>
          {remaining.map((s) => (
            <Chip key={s} label={`+ ${s}`} onPress={() => add(s)} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
});

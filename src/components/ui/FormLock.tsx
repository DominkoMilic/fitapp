import { createContext, type PropsWithChildren, useContext, useEffect } from 'react';
import { spacing } from '@/theme';
import { Keyboard, type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';

const FormLockContext = createContext(false);

/** True inside a form that is being saved: fields show their values but can't be changed. */
export const useFormLocked = () => useContext(FormLockContext);

/**
 * Wraps the fields of a form while it is saving. Nothing inside can be pressed or typed into,
 * the keyboard closes and the fields dim, so no one edits values that won't be part of the save.
 * The Save button itself stays outside (it shows the progress).
 */
export function FormLock({
  locked,
  style,
  children,
}: PropsWithChildren<{ locked: boolean; style?: StyleProp<ViewStyle> }>) {
  const parent = useContext(FormLockContext);
  const on = locked || parent;
  useEffect(() => {
    if (locked) Keyboard.dismiss();
  }, [locked]);
  return (
    <FormLockContext.Provider value={on}>
      <View
        pointerEvents={on ? 'none' : 'auto'}
        accessibilityState={on ? { disabled: true, busy: true } : undefined}
        testID={locked ? 'form-locked' : undefined}
        style={[styles.box, style, locked ? styles.locked : null]}
      >
        {children}
      </View>
    </FormLockContext.Provider>
  );
}

const styles = StyleSheet.create({
  // Same spacing between fields as a Screen's content.
  box: { gap: spacing.md },
  locked: { opacity: 0.6 },
});

import { useCallback, useState } from 'react';

export type FieldErrors<F extends string> = Partial<Record<F, string>>;

/**
 * Validation messages shown on the field they belong to (red border + message under it) instead
 * of a banner. `show(errors)` replaces them all and returns true when there are none; a field's
 * message disappears as soon as that field is edited (`clear`).
 */
export function useFieldErrors<F extends string>() {
  const [errors, setErrors] = useState<FieldErrors<F>>({});
  const show = useCallback((next: FieldErrors<F>) => {
    setErrors(next);
    return Object.keys(next).length === 0;
  }, []);
  const clear = useCallback((field: F) => {
    setErrors((e) => {
      if (!(field in e)) return e;
      const rest = { ...e };
      delete rest[field];
      return rest;
    });
  }, []);
  return { errors, show, clear };
}

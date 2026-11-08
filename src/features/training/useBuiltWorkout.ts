import { useMemo } from 'react';

import { EXERCISE_BY_SLUG, TEMPLATE_BY_SLUG } from '@/domain/training/catalogue';
import { buildWorkout, type BuiltWorkout } from '@/domain/training/workout-builder';

import { useOwnedEquipment, useRestrictions } from './library';

/** Concrete exercise list for a template, adjusted for today's injuries and equipment. */
export function useBuiltWorkout(templateSlug: string | null | undefined): BuiltWorkout | null {
  const restrictions = useRestrictions();
  const owned = useOwnedEquipment();
  return useMemo(() => {
    const template = templateSlug ? TEMPLATE_BY_SLUG[templateSlug] : undefined;
    if (!template) return null;
    return buildWorkout({
      template,
      exercisesBySlug: EXERCISE_BY_SLUG,
      restrictions: restrictions.tags,
      ownedEquipment: owned,
    });
  }, [templateSlug, restrictions.tags, owned]);
}

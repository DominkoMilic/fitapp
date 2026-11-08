/**
 * Builds the concrete exercise list for a template, applying the user's equipment and injury
 * restrictions (spec 9.2, 10.4, 28.5 #13–14). Pure.
 */
import type {
  CatalogueExercise,
  CatalogueTemplate,
  TemplatePhase,
  TrackingType,
} from './catalogue';
import { isContraindicated, type RestrictionTag } from './injury';

export interface PlannedExercise {
  slug: string;
  name: string;
  phase: TemplatePhase;
  tracking: TrackingType;
  sets: number;
  repsMin: number | null;
  repsMax: number | null;
  durationS: number | null;
  restS: number;
  unilateral: boolean;
  /** Original exercise when this one is a substitute. */
  substitutedFor: string | null;
}

export type RemovalReason = 'injury' | 'equipment';

export interface BuiltWorkout {
  title: string;
  templateSlug: string;
  exercises: PlannedExercise[];
  removed: { slug: string; name: string; reason: RemovalReason }[];
  adjustedForInjury: boolean;
  /** Fewer than 3 main exercises remain: suggest a recovery session instead (spec 28.5 #14). */
  tooFewExercises: boolean;
}

/** Every requirement must be met; "a|b" means either. "none"/empty ownership = bodyweight only. */
export function equipmentSatisfied(
  requirements: readonly string[],
  owned: ReadonlySet<string>,
): boolean {
  return requirements.every((req) => req.split('|').some((opt) => owned.has(opt)));
}

type Check = { ok: true } | { ok: false; reason: RemovalReason };

function check(
  e: CatalogueExercise,
  restrictions: readonly RestrictionTag[],
  owned: ReadonlySet<string>,
): Check {
  if (isContraindicated(e.contraindications as RestrictionTag[], restrictions))
    return { ok: false, reason: 'injury' };
  if (!equipmentSatisfied(e.equipment, owned)) return { ok: false, reason: 'equipment' };
  return { ok: true };
}

export function buildWorkout(input: {
  template: CatalogueTemplate;
  exercisesBySlug: Readonly<Record<string, CatalogueExercise>>;
  restrictions: readonly RestrictionTag[];
  ownedEquipment: ReadonlySet<string>;
}): BuiltWorkout {
  const { template, exercisesBySlug, restrictions, ownedEquipment } = input;
  const exercises: PlannedExercise[] = [];
  const removed: BuiltWorkout['removed'] = [];
  let adjustedForInjury = false;

  for (const item of template.exercises) {
    const original = exercisesBySlug[item.slug];
    if (!original) continue;
    let chosen: CatalogueExercise | null = original;
    let substitutedFor: string | null = null;
    const first = check(original, restrictions, ownedEquipment);
    if (!first.ok) {
      if (first.reason === 'injury') adjustedForInjury = true;
      const alt = item.alternative ? exercisesBySlug[item.alternative] : undefined;
      if (alt && check(alt, restrictions, ownedEquipment).ok) {
        chosen = alt;
        substitutedFor = original.slug;
      } else {
        chosen = null;
        removed.push({ slug: original.slug, name: original.name, reason: first.reason });
      }
    }
    if (!chosen) continue;
    // The alternative is already in this phase: drop the original, but say so.
    if (exercises.some((x) => x.slug === chosen!.slug && x.phase === item.phase)) {
      if (substitutedFor)
        removed.push({
          slug: original.slug,
          name: original.name,
          reason: first.ok ? 'equipment' : first.reason,
        });
      continue;
    }
    const usesTime = chosen.tracking === 'time';
    exercises.push({
      slug: chosen.slug,
      name: chosen.name,
      phase: item.phase,
      tracking: chosen.tracking,
      sets: item.sets,
      repsMin: usesTime
        ? null
        : ((substitutedFor ? chosen.repsMin : item.repsMin) ?? chosen.repsMin),
      repsMax: usesTime
        ? null
        : ((substitutedFor ? chosen.repsMax : item.repsMax) ?? chosen.repsMax),
      durationS: usesTime
        ? ((substitutedFor ? chosen.durationS : item.durationS) ?? chosen.durationS)
        : null,
      restS: item.restS,
      unilateral: chosen.unilateral,
      substitutedFor,
    });
  }
  const main = exercises.filter((e) => e.phase === 'main').length;
  return {
    title: template.name,
    templateSlug: template.slug,
    exercises,
    removed,
    adjustedForInjury,
    tooFewExercises: template.category === 'strength' && main < 3,
  };
}

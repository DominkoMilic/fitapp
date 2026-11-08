/** Injury and restriction model (spec section 9). Pure data + functions. */

export type BodyArea =
  | 'ankle_foot'
  | 'calf_achilles'
  | 'knee'
  | 'hip_groin'
  | 'hamstring'
  | 'lower_back'
  | 'shoulder'
  | 'elbow_wrist_hand'
  | 'neck'
  | 'other';

export type InjuryStatus =
  'active' | 'recovering' | 'cleared_training' | 'cleared_sport' | 'resolved';

export type RestrictionTag =
  | 'impact'
  | 'jumping'
  | 'lateral'
  | 'sprint'
  | 'ankle_load_high'
  | 'single_leg_balance'
  | 'deep_knee_flexion'
  | 'deep_hip_flexion'
  | 'hinge_loaded'
  | 'spinal_loaded'
  | 'overhead'
  | 'push_loaded'
  | 'wrist_load'
  | 'grip_heavy';

export const BODY_AREA_LABELS: Record<BodyArea, string> = {
  ankle_foot: 'Ankle / foot',
  calf_achilles: 'Calf / Achilles',
  knee: 'Knee',
  hip_groin: 'Hip / groin',
  hamstring: 'Hamstring',
  lower_back: 'Lower back',
  shoulder: 'Shoulder',
  elbow_wrist_hand: 'Elbow / wrist / hand',
  neck: 'Neck',
  other: 'Other',
};

export const INJURY_STATUS_INFO: Record<InjuryStatus, { title: string; description: string }> = {
  active: {
    title: 'Active',
    description: 'Painful now; walking or daily activities are affected',
  },
  recovering: {
    title: 'Recovering',
    description: 'Walking is comfortable, but you are not back to sport yet',
  },
  cleared_training: {
    title: 'Cleared for training',
    description: 'Controlled gym-type training is fine; no sport yet',
  },
  cleared_sport: { title: 'Cleared for sport', description: 'Back to full sport' },
  resolved: { title: 'Resolved', description: 'History only' },
};

export const AREA_RESTRICTIONS: Record<BodyArea, readonly RestrictionTag[]> = {
  ankle_foot: ['impact', 'jumping', 'lateral', 'sprint', 'ankle_load_high', 'single_leg_balance'],
  calf_achilles: ['impact', 'jumping', 'sprint', 'ankle_load_high'],
  knee: ['impact', 'jumping', 'lateral', 'sprint', 'deep_knee_flexion'],
  hip_groin: ['lateral', 'sprint', 'deep_hip_flexion'],
  hamstring: ['sprint', 'hinge_loaded'],
  lower_back: ['spinal_loaded', 'hinge_loaded', 'impact'],
  shoulder: ['overhead', 'push_loaded'],
  elbow_wrist_hand: ['wrist_load', 'grip_heavy'],
  neck: ['overhead', 'spinal_loaded'],
  other: [],
};

const SPORT_TAGS: readonly RestrictionTag[] = ['impact', 'jumping', 'lateral', 'sprint'];

/** Areas whose injury affects lower-body sessions and sport. */
export const LOWER_BODY_AREAS: readonly BodyArea[] = [
  'ankle_foot',
  'calf_achilles',
  'knee',
  'hip_groin',
  'hamstring',
];

export interface InjuryLike {
  bodyArea: BodyArea | null;
  status: InjuryStatus;
  /** Tags the user added manually (e.g. for 'other' areas). */
  extraTags?: readonly RestrictionTag[];
}

/**
 * Restriction tags in force for one injury (spec 9.2 stage filtering):
 * active/recovering → all tags for the area; cleared_training → only impact, jumping,
 * lateral and sprint; cleared_sport/resolved → none.
 */
export function restrictionTagsFor(injury: InjuryLike): RestrictionTag[] {
  const areaTags = injury.bodyArea ? AREA_RESTRICTIONS[injury.bodyArea] : [];
  const all = [...areaTags, ...(injury.extraTags ?? [])];
  switch (injury.status) {
    case 'active':
    case 'recovering':
      return unique(all);
    case 'cleared_training':
      return unique(all.filter((t) => SPORT_TAGS.includes(t)));
    case 'cleared_sport':
    case 'resolved':
      return [];
  }
}

export function activeRestrictions(injuries: readonly InjuryLike[]): RestrictionTag[] {
  return unique(injuries.flatMap(restrictionTagsFor));
}

/** True when an exercise with these contraindication tags must be excluded. */
export function isContraindicated(
  contraindications: readonly RestrictionTag[],
  restrictions: readonly RestrictionTag[],
): boolean {
  return contraindications.some((t) => restrictions.includes(t));
}

/** Sport (matches, practices) is not recommended until the user marks cleared_sport. */
export function sportRestricted(injuries: readonly InjuryLike[]): boolean {
  return injuries.some(
    (i) =>
      i.bodyArea !== null &&
      LOWER_BODY_AREAS.includes(i.bodyArea) &&
      (i.status === 'active' || i.status === 'recovering' || i.status === 'cleared_training'),
  );
}

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

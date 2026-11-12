/**
 * Exercise animations (2026-11-12): an original stick figure, posed by joint angles and looped
 * between a few keyframes per movement pattern. Pure TypeScript, no React. The frame maths is
 * marked 'worklet' so the same code runs on the UI thread (reanimated) and in tests.
 *
 * Angles are degrees, absolute (not relative to the parent bone), measured from straight down
 * and growing towards the figure's front: 0 = down, 90 = forward, 180 = up, -90 = backward.
 * In front view "forward" is the viewer's right. N = near limb (drawn solid), F = far limb.
 */

export type MotionView = 'side' | 'front';

export interface Pose {
  torso: number;
  thighN: number;
  shinN: number;
  thighF: number;
  shinF: number;
  armN: number;
  foreN: number;
  armF: number;
  foreF: number;
  /** Foot direction; defaults to 90 (flat, toes forward). 0 = toes down, e.g. on tiptoe. */
  footN?: number;
  footF?: number;
  /** Head direction relative to the torso (+ looks up, − tucks the chin). */
  head?: number;
  /** Raise the whole body off the floor (jumps), in figure units. */
  lift?: number;
  /** Shift the whole body sideways (lateral steps), in figure units. */
  dx?: number;
}

/** Which point stays put horizontally; `y` pins it vertically too (e.g. hands on a bar). */
export interface Anchor {
  joint: 'ankleN' | 'ankleF' | 'hip' | 'handN';
  y?: number;
}

export interface MotionPattern {
  id: string;
  view: MotionView;
  /** One full loop through all keyframes, ms. */
  tempoMs: number;
  anchor: Anchor;
  /** Keyframes, looped: the last eases back into the first. Two equal frames = a hold. */
  keys: Pose[];
  /** A static prop to draw. */
  prop?: 'bar';
}

/** Bone lengths in figure units (≈ 100 tall standing). */
export const BONES = {
  torso: 30,
  neck: 4,
  headR: 6.5,
  thigh: 23,
  shin: 23,
  arm: 16,
  fore: 15,
  foot: 6,
} as const;
export const VIEW_W = 120;
export const VIEW_H = 134;
export const FLOOR_Y = 128;
/** Stored key order: interpolation runs over these indexes. */
const KEYS = [
  'torso',
  'thighN',
  'shinN',
  'thighF',
  'shinF',
  'armN',
  'foreN',
  'armF',
  'foreF',
  'footN',
  'footF',
  'head',
  'lift',
  'dx',
] as const;
export const POSE_LENGTH = KEYS.length;

/** A pose as a flat number array (what the UI thread interpolates). */
export function poseToArray(p: Pose, view: MotionView): number[] {
  const sideFoot = 90;
  return [
    p.torso,
    p.thighN,
    p.shinN,
    p.thighF,
    p.shinF,
    p.armN,
    p.foreN,
    p.armF,
    p.foreF,
    p.footN ?? (view === 'front' ? 90 : sideFoot),
    p.footF ?? (view === 'front' ? -90 : sideFoot),
    p.head ?? 0,
    p.lift ?? 0,
    p.dx ?? 0,
  ];
}

/** Joint positions of one frame, in view coordinates (y down). */
export interface Skeleton {
  hip: [number, number];
  shoulder: [number, number];
  head: [number, number];
  kneeN: [number, number];
  ankleN: [number, number];
  toeN: [number, number];
  kneeF: [number, number];
  ankleF: [number, number];
  toeF: [number, number];
  elbowN: [number, number];
  handN: [number, number];
  elbowF: [number, number];
  handF: [number, number];
}

const RAD = Math.PI / 180;

/**
 * Forward kinematics for a flat pose array, then placed in the view: the anchor joint sits at
 * `anchorX` (and at `anchor.y` when given, else the lowest point touches the floor), minus lift.
 */
export function skeletonOf(
  a: readonly number[],
  anchorJoint: number,
  anchorX: number,
  anchorY: number | null,
): Skeleton {
  'worklet';
  const at = (from: [number, number], deg: number, len: number): [number, number] => [
    from[0] + Math.sin(deg * RAD) * len,
    from[1] + Math.cos(deg * RAD) * len,
  ];
  const hip: [number, number] = [0, 0];
  const shoulder = at(hip, a[0]!, BONES.torso);
  const head = at(shoulder, a[0]! + a[11]!, BONES.neck + BONES.headR);
  const kneeN = at(hip, a[1]!, BONES.thigh);
  const ankleN = at(kneeN, a[2]!, BONES.shin);
  const toeN = at(ankleN, a[9]!, BONES.foot);
  const kneeF = at(hip, a[3]!, BONES.thigh);
  const ankleF = at(kneeF, a[4]!, BONES.shin);
  const toeF = at(ankleF, a[10]!, BONES.foot);
  const elbowN = at(shoulder, a[5]!, BONES.arm);
  const handN = at(elbowN, a[6]!, BONES.fore);
  const elbowF = at(shoulder, a[7]!, BONES.arm);
  const handF = at(elbowF, a[8]!, BONES.fore);
  const pts = [
    hip,
    shoulder,
    kneeN,
    ankleN,
    toeN,
    kneeF,
    ankleF,
    toeF,
    elbowN,
    handN,
    elbowF,
    handF,
  ];
  const anchor =
    anchorJoint === 0 ? ankleN : anchorJoint === 1 ? ankleF : anchorJoint === 2 ? hip : handN;
  let ox = anchorX - anchor[0] + a[13]!;
  let oy: number;
  if (anchorY !== null) {
    oy = anchorY - anchor[1];
  } else {
    let low = -Infinity;
    for (const p of pts) if (p[1] > low) low = p[1];
    // The head is a circle: its bottom edge counts too (lying down).
    if (head[1] + BONES.headR > low) low = head[1] + BONES.headR;
    oy = FLOOR_Y - low;
  }
  oy -= a[12]!;
  const m = (p: [number, number]): [number, number] => [p[0] + ox, p[1] + oy];
  ox = ox + 0; // keep both offsets mutable-readable for the worklet compiler
  return {
    hip: m(hip),
    shoulder: m(shoulder),
    head: m(head),
    kneeN: m(kneeN),
    ankleN: m(ankleN),
    toeN: m(toeN),
    kneeF: m(kneeF),
    ankleF: m(ankleF),
    toeF: m(toeF),
    elbowN: m(elbowN),
    handN: m(handN),
    elbowF: m(elbowF),
    handF: m(handF),
  };
}

/** Pose at loop position `t` (0 … keys, wrapping), eased between neighbouring keyframes. */
export function poseAt(keys: readonly (readonly number[])[], t: number): number[] {
  'worklet';
  const n = keys.length;
  const tt = ((t % n) + n) % n;
  const i = Math.floor(tt);
  const f = tt - i;
  const e = f * f * (3 - 2 * f); // smoothstep: eases in and out of each pose
  const A = keys[i]!;
  const B = keys[(i + 1) % n]!;
  const out: number[] = [];
  for (let k = 0; k < A.length; k++) out.push(A[k]! + (B[k]! - A[k]!) * e);
  return out;
}

const fx = (p: [number, number]) => {
  'worklet';
  return `${p[0].toFixed(1)} ${p[1].toFixed(1)}`;
};

/** SVG path data: near side (torso, near leg, near arm) and far side (far leg and arm). */
export function skeletonPaths(s: Skeleton): { near: string; far: string } {
  'worklet';
  return {
    near:
      `M${fx(s.hip)}L${fx(s.shoulder)}` +
      `M${fx(s.hip)}L${fx(s.kneeN)}L${fx(s.ankleN)}L${fx(s.toeN)}` +
      `M${fx(s.shoulder)}L${fx(s.elbowN)}L${fx(s.handN)}`,
    far:
      `M${fx(s.hip)}L${fx(s.kneeF)}L${fx(s.ankleF)}L${fx(s.toeF)}` +
      `M${fx(s.shoulder)}L${fx(s.elbowF)}L${fx(s.handF)}`,
  };
}

export const anchorIndex = (a: Anchor): number =>
  a.joint === 'ankleN' ? 0 : a.joint === 'ankleF' ? 1 : a.joint === 'hip' ? 2 : 3;

/** A pattern ready to draw: flat keyframes and the anchor x that centres it in the view. */
export interface PreparedMotion {
  pattern: MotionPattern;
  keys: number[][];
  anchorJoint: number;
  anchorX: number;
  anchorY: number | null;
  /**
   * The part of the view this pattern uses across the whole loop (plus padding), floor
   * included. Drawing with this as the SVG viewBox lets a push-up fill the box as well as a squat.
   */
  frame: { x: number; y: number; w: number; h: number };
}

const FRAME_PAD = 7;

export function prepareMotion(pattern: MotionPattern): PreparedMotion {
  const keys = pattern.keys.map((k) => poseToArray(k, pattern.view));
  const anchorJoint = anchorIndex(pattern.anchor);
  const anchorY = pattern.anchor.y ?? null;
  // Every point the figure reaches over the loop (in-between poses too).
  const bounds = (ax: number) => {
    let lo = Infinity;
    let hi = -Infinity;
    let top = Infinity;
    for (let t = 0; t < keys.length; t += 0.125) {
      const s = skeletonOf(poseAt(keys, t), anchorJoint, ax, anchorY);
      for (const p of Object.values(s)) {
        lo = Math.min(lo, p[0]);
        hi = Math.max(hi, p[0]);
        top = Math.min(top, p[1]);
      }
      lo = Math.min(lo, s.head[0] - BONES.headR);
      hi = Math.max(hi, s.head[0] + BONES.headR);
      top = Math.min(top, s.head[1] - BONES.headR);
    }
    return { lo, hi, top };
  };
  const raw = bounds(0);
  const anchorX = VIEW_W / 2 - (raw.lo + raw.hi) / 2;
  const b = bounds(anchorX);
  const top = Math.min(b.top, anchorY ?? Infinity) - FRAME_PAD;
  const bottom = FLOOR_Y + FRAME_PAD;
  return {
    pattern,
    keys,
    anchorJoint,
    anchorX,
    anchorY,
    frame: { x: b.lo - FRAME_PAD, y: top, w: b.hi - b.lo + 2 * FRAME_PAD, h: bottom - top },
  };
}

// --------------------------------------------------------------------------------- patterns

const STAND: Pose = {
  torso: 180,
  thighN: 0,
  shinN: 0,
  thighF: 0,
  shinF: 0,
  armN: 6,
  foreN: 10,
  armF: -4,
  foreF: 0,
};
const both = (arm: number, fore: number) => ({ armN: arm, foreN: fore, armF: arm, foreF: fore });
const legs = (thigh: number, shin: number) => ({
  thighN: thigh,
  shinN: shin,
  thighF: thigh,
  shinF: shin,
});
/** Front view: the far limb mirrors the near one. */
const mirror = (p: Omit<Pose, 'thighF' | 'shinF' | 'armF' | 'foreF'>): Pose => ({
  ...p,
  thighF: -p.thighN,
  shinF: -p.shinN,
  armF: -p.armN,
  foreF: -p.foreN,
});
const FRONT_STAND = mirror({ torso: 180, thighN: 4, shinN: 4, armN: 8, foreN: 8 });

const foot = { anchor: { joint: 'ankleN' } as Anchor };
const hipAnchor = { anchor: { joint: 'hip' } as Anchor };
const handAnchor = { anchor: { joint: 'handN' } as Anchor };

// Prone (face down, head to the right) bodies: legs point back-down from the hip.
const PUSH_TOP: Pose = { torso: 110, ...legs(-70, -70), ...both(0, 0), footN: 20, footF: 20 };
const ALL_FOURS: Pose = { torso: 75, ...legs(0, -90), ...both(0, 0), footN: -90, footF: -90 };
// Supine (on the back, head to the left), knees bent with feet flat.
const HOOK_LYING: Pose = { torso: -90, ...legs(135, 35), ...both(90, 90) };

export const PATTERNS: Record<string, MotionPattern> = {
  squat: {
    id: 'squat',
    view: 'side',
    tempoMs: 2600,
    ...foot,
    keys: [
      { ...STAND, ...both(8, 10) },
      { torso: 145, ...legs(80, -28), ...both(85, 90) },
    ],
  },
  'goblet-squat': {
    id: 'goblet-squat',
    view: 'side',
    tempoMs: 2800,
    ...foot,
    keys: [
      { ...STAND, ...both(15, 160) },
      { torso: 150, ...legs(80, -28), ...both(48, 172) },
    ],
  },
  'squat-hold': {
    id: 'squat-hold',
    view: 'side',
    tempoMs: 3600,
    ...foot,
    keys: [
      { torso: 176, ...legs(86, 0), ...both(70, 85) },
      { torso: 179, ...legs(84, 0), ...both(72, 85) },
    ],
  },
  'athletic-stance': {
    id: 'athletic-stance',
    view: 'side',
    tempoMs: 3200,
    ...foot,
    keys: [
      { torso: 150, ...legs(48, -22), ...both(40, 70) },
      { torso: 153, ...legs(44, -20), ...both(40, 72) },
    ],
  },
  lunge: {
    id: 'lunge',
    view: 'side',
    tempoMs: 2800,
    ...foot,
    keys: [
      { ...STAND, ...both(0, 0) },
      { torso: 180, thighN: 82, shinN: -5, thighF: -22, shinF: -85, ...both(0, 0), footF: 20 },
    ],
  },
  'split-squat': {
    id: 'split-squat',
    view: 'side',
    tempoMs: 2800,
    ...foot,
    keys: [
      { torso: 180, thighN: 25, shinN: 5, thighF: -20, shinF: -25, ...both(0, 0), footF: 40 },
      { torso: 180, thighN: 82, shinN: -5, thighF: -22, shinF: -85, ...both(0, 0), footF: 20 },
    ],
  },
  'lunge-stretch': {
    id: 'lunge-stretch',
    view: 'side',
    tempoMs: 4200,
    ...foot,
    keys: [
      { torso: 180, thighN: 75, shinN: -8, thighF: -45, shinF: -95, ...both(0, 0), footF: -90 },
      {
        torso: 186,
        thighN: 72,
        shinN: -12,
        thighF: -52,
        shinF: -95,
        ...both(172, 176),
        footF: -90,
      },
    ],
  },
  hinge: {
    id: 'hinge',
    view: 'side',
    tempoMs: 2800,
    ...foot,
    keys: [
      { ...STAND, ...both(0, 0) },
      { torso: 100, ...legs(14, -6), ...both(0, 0) },
    ],
  },
  'hamstring-stretch': {
    id: 'hamstring-stretch',
    view: 'side',
    tempoMs: 4200,
    anchor: { joint: 'ankleF' },
    keys: [
      { torso: 125, thighN: 25, shinN: 25, thighF: -6, shinF: -6, ...both(12, 12), footN: 160 },
      { torso: 112, thighN: 25, shinN: 25, thighF: -8, shinF: -8, ...both(18, 18), footN: 160 },
    ],
  },
  swing: {
    id: 'swing',
    view: 'side',
    tempoMs: 1600,
    ...foot,
    keys: [
      { torso: 115, ...legs(25, -15), ...both(-15, -15) },
      { ...STAND, ...both(90, 90) },
    ],
  },
  bridge: {
    id: 'bridge',
    view: 'side',
    tempoMs: 2600,
    ...foot,
    keys: [HOOK_LYING, { torso: -62, ...legs(105, 8), ...both(90, 90) }],
  },
  'floor-press': {
    id: 'floor-press',
    view: 'side',
    tempoMs: 2400,
    ...hipAnchor,
    keys: [
      { ...HOOK_LYING, ...both(90, 180) },
      { ...HOOK_LYING, ...both(180, 180) },
    ],
  },
  hollow: {
    id: 'hollow',
    view: 'side',
    tempoMs: 3200,
    ...hipAnchor,
    keys: [
      { torso: -105, ...legs(100, 100), ...both(-110, -110) },
      { torso: -102, ...legs(98, 98), ...both(-108, -108) },
    ],
  },
  'dead-bug': {
    id: 'dead-bug',
    view: 'side',
    tempoMs: 4400,
    ...hipAnchor,
    keys: [
      { torso: -90, ...legs(180, 90), ...both(180, 180) },
      {
        torso: -90,
        thighN: 100,
        shinN: 100,
        thighF: 180,
        shinF: 90,
        armN: 180,
        foreN: 180,
        armF: -95,
        foreF: -95,
      },
      { torso: -90, ...legs(180, 90), ...both(180, 180) },
      {
        torso: -90,
        thighN: 180,
        shinN: 90,
        thighF: 100,
        shinF: 100,
        armN: -95,
        foreN: -95,
        armF: 180,
        foreF: 180,
      },
    ],
  },
  'flutter-kick': {
    id: 'flutter-kick',
    view: 'side',
    tempoMs: 900,
    ...hipAnchor,
    keys: [
      { torso: -96, thighN: 100, shinN: 100, thighF: 112, shinF: 112, ...both(90, 90) },
      { torso: -96, thighN: 112, shinN: 112, thighF: 100, shinF: 100, ...both(90, 90) },
    ],
  },
  'push-up': {
    id: 'push-up',
    view: 'side',
    tempoMs: 2400,
    ...foot,
    keys: [PUSH_TOP, { torso: 95, ...legs(-85, -85), ...both(-100, 0), footN: 20, footF: 20 }],
  },
  plank: {
    id: 'plank',
    view: 'side',
    tempoMs: 3200,
    ...foot,
    keys: [
      { torso: 98, ...legs(-82, -82), ...both(0, 90), footN: 20, footF: 20 },
      { torso: 99, ...legs(-81, -81), ...both(0, 90), footN: 20, footF: 20 },
    ],
  },
  'mountain-climber': {
    id: 'mountain-climber',
    view: 'side',
    tempoMs: 800,
    ...handAnchor,
    keys: [
      { ...PUSH_TOP, thighN: 25, shinN: -60 },
      { ...PUSH_TOP, thighF: 25, shinF: -60 },
    ],
  },
  'bear-crawl': {
    id: 'bear-crawl',
    view: 'side',
    tempoMs: 1400,
    ...hipAnchor,
    keys: [
      {
        torso: 85,
        thighN: 35,
        shinN: -70,
        thighF: 5,
        shinF: -85,
        armN: -12,
        foreN: -12,
        armF: 15,
        foreF: 15,
        footN: 0,
        footF: 0,
      },
      {
        torso: 85,
        thighN: 5,
        shinN: -85,
        thighF: 35,
        shinF: -70,
        armN: 15,
        foreN: 15,
        armF: -12,
        foreF: -12,
        footN: 0,
        footF: 0,
      },
    ],
  },
  'bird-dog': {
    id: 'bird-dog',
    view: 'side',
    tempoMs: 4400,
    ...hipAnchor,
    keys: [
      ALL_FOURS,
      { ...ALL_FOURS, armN: 95, foreN: 95, thighF: -95, shinF: -95 },
      ALL_FOURS,
      { ...ALL_FOURS, armF: 95, foreF: 95, thighN: -95, shinN: -95 },
    ],
  },
  'cat-cow': {
    id: 'cat-cow',
    view: 'side',
    tempoMs: 4400,
    ...hipAnchor,
    keys: [
      { ...ALL_FOURS, torso: 78, head: 25 },
      { ...ALL_FOURS, torso: 71, head: -20 },
    ],
  },
  'jumping-jack': {
    id: 'jumping-jack',
    view: 'front',
    tempoMs: 1000,
    ...hipAnchor,
    keys: [FRONT_STAND, mirror({ torso: 180, thighN: 22, shinN: 22, armN: 165, foreN: 175 })],
  },
  'lateral-raise': {
    id: 'lateral-raise',
    view: 'front',
    tempoMs: 2600,
    ...hipAnchor,
    keys: [FRONT_STAND, mirror({ torso: 180, thighN: 4, shinN: 4, armN: 85, foreN: 92 })],
  },
  'pull-apart': {
    id: 'pull-apart',
    view: 'front',
    tempoMs: 2200,
    ...hipAnchor,
    keys: [
      mirror({ torso: 180, thighN: 4, shinN: 4, armN: 60, foreN: -70 }),
      mirror({ torso: 180, thighN: 4, shinN: 4, armN: 90, foreN: 92 }),
    ],
  },
  'arm-circles': {
    id: 'arm-circles',
    view: 'front',
    tempoMs: 1200,
    ...hipAnchor,
    keys: [
      mirror({ torso: 180, thighN: 4, shinN: 4, armN: 80, foreN: 80 }),
      mirror({ torso: 180, thighN: 4, shinN: 4, armN: 92, foreN: 92 }),
      mirror({ torso: 180, thighN: 4, shinN: 4, armN: 100, foreN: 100 }),
      mirror({ torso: 180, thighN: 4, shinN: 4, armN: 88, foreN: 88 }),
    ],
  },
  'lateral-lunge': {
    id: 'lateral-lunge',
    view: 'front',
    tempoMs: 2800,
    anchor: { joint: 'ankleF' },
    keys: [
      {
        torso: 180,
        thighN: 25,
        shinN: 25,
        thighF: -25,
        shinF: -25,
        armN: 10,
        foreN: 60,
        armF: -10,
        foreF: -60,
      },
      {
        torso: 168,
        thighN: 62,
        shinN: -12,
        thighF: -38,
        shinF: -38,
        armN: 20,
        foreN: 70,
        armF: 0,
        foreF: -40,
      },
    ],
  },
  shuffle: {
    id: 'shuffle',
    view: 'front',
    tempoMs: 900,
    ...hipAnchor,
    keys: [
      mirror({ torso: 180, thighN: 14, shinN: 6, armN: 30, foreN: 50 }),
      { ...mirror({ torso: 180, thighN: 30, shinN: 22, armN: 30, foreN: 50 }), lift: 3 },
    ],
  },
  skater: {
    id: 'skater',
    view: 'front',
    tempoMs: 1600,
    ...hipAnchor,
    keys: [
      {
        torso: 172,
        thighN: 18,
        shinN: -8,
        thighF: 28,
        shinF: 40,
        armN: -30,
        foreN: -40,
        armF: -50,
        foreF: -60,
        dx: 14,
      },
      { ...mirror({ torso: 180, thighN: 10, shinN: 10, armN: 20, foreN: 20 }), lift: 10 },
      {
        torso: 188,
        thighN: -28,
        shinN: -40,
        thighF: -18,
        shinF: 8,
        armN: 50,
        foreN: 60,
        armF: 30,
        foreF: 40,
        dx: -14,
      },
      { ...mirror({ torso: 180, thighN: 10, shinN: 10, armN: 20, foreN: 20 }), lift: 10 },
    ],
  },
  'quick-feet': {
    id: 'quick-feet',
    view: 'side',
    tempoMs: 450,
    ...hipAnchor,
    keys: [
      { torso: 160, thighN: 40, shinN: -15, thighF: 25, shinF: -25, ...both(30, 90), footF: 40 },
      {
        torso: 160,
        thighN: 25,
        shinN: -25,
        thighF: 40,
        shinF: -15,
        ...both(30, 90),
        footN: 40,
        lift: 2,
      },
    ],
  },
  'high-knees': {
    id: 'high-knees',
    view: 'side',
    tempoMs: 700,
    ...hipAnchor,
    keys: [
      {
        torso: 178,
        thighN: 95,
        shinN: 0,
        thighF: 0,
        shinF: 0,
        armN: -40,
        foreN: 80,
        armF: 45,
        foreF: 150,
        footF: 30,
        lift: 2,
      },
      {
        torso: 178,
        thighN: 0,
        shinN: 0,
        thighF: 95,
        shinF: 0,
        armN: 45,
        foreN: 150,
        armF: -40,
        foreF: 80,
        footN: 30,
        lift: 2,
      },
    ],
  },
  march: {
    id: 'march',
    view: 'side',
    tempoMs: 1300,
    ...hipAnchor,
    keys: [
      {
        torso: 180,
        thighN: 65,
        shinN: 0,
        thighF: 0,
        shinF: 0,
        armN: -25,
        foreN: 40,
        armF: 30,
        foreF: 100,
      },
      {
        torso: 180,
        thighN: 0,
        shinN: 0,
        thighF: 65,
        shinF: 0,
        armN: 30,
        foreN: 100,
        armF: -25,
        foreF: 40,
      },
    ],
  },
  run: {
    id: 'run',
    view: 'side',
    tempoMs: 700,
    ...hipAnchor,
    keys: [
      {
        torso: 170,
        thighN: 55,
        shinN: -25,
        thighF: -30,
        shinF: -105,
        armN: -45,
        foreN: 45,
        armF: 50,
        foreF: 150,
        lift: 3,
      },
      {
        torso: 170,
        thighN: -30,
        shinN: -105,
        thighF: 55,
        shinF: -25,
        armN: 50,
        foreN: 150,
        armF: -45,
        foreF: 45,
        lift: 3,
      },
    ],
  },
  walk: {
    id: 'walk',
    view: 'side',
    tempoMs: 1200,
    ...hipAnchor,
    keys: [
      {
        torso: 180,
        thighN: 22,
        shinN: 5,
        thighF: -18,
        shinF: -25,
        armN: -20,
        foreN: -10,
        armF: 20,
        foreF: 35,
        footF: 40,
      },
      {
        torso: 180,
        thighN: -18,
        shinN: -25,
        thighF: 22,
        shinF: 5,
        armN: 20,
        foreN: 35,
        armF: -20,
        foreF: -10,
        footN: 40,
      },
    ],
  },
  'knee-hug': {
    id: 'knee-hug',
    view: 'side',
    tempoMs: 2600,
    anchor: { joint: 'ankleF' },
    keys: [
      { ...STAND, ...both(0, 0) },
      { torso: 180, thighN: 128, shinN: -15, thighF: 0, shinF: 0, ...both(45, 110) },
    ],
  },
  balance: {
    id: 'balance',
    view: 'side',
    tempoMs: 3200,
    anchor: { joint: 'ankleF' },
    keys: [
      { torso: 178, thighN: 80, shinN: 0, thighF: 0, shinF: 0, ...both(60, 70) },
      { torso: 182, thighN: 78, shinN: 0, thighF: 0, shinF: 0, ...both(62, 72) },
    ],
  },
  'leg-swing': {
    id: 'leg-swing',
    view: 'side',
    tempoMs: 1600,
    anchor: { joint: 'ankleF' },
    keys: [
      { torso: 180, thighN: -35, shinN: -35, thighF: 0, shinF: 0, ...both(85, 90) },
      { torso: 180, thighN: 60, shinN: 60, thighF: 0, shinF: 0, ...both(85, 90) },
    ],
  },
  jump: {
    id: 'jump',
    view: 'side',
    tempoMs: 1500,
    ...foot,
    keys: [
      { torso: 140, ...legs(70, -30), ...both(-40, -40) },
      { torso: 180, ...legs(0, 0), ...both(175, 178), footN: 20, footF: 20, lift: 10 },
    ],
  },
  burpee: {
    id: 'burpee',
    view: 'side',
    tempoMs: 3600,
    ...handAnchor,
    keys: [
      { ...STAND, ...both(0, 0) },
      { torso: 120, ...legs(88, -30), ...both(0, 0) },
      PUSH_TOP,
      { torso: 120, ...legs(88, -30), ...both(0, 0) },
      { torso: 180, ...legs(0, 0), ...both(175, 178), footN: 20, footF: 20, lift: 12 },
    ],
  },
  'jump-rope': {
    id: 'jump-rope',
    view: 'side',
    tempoMs: 500,
    ...foot,
    keys: [
      { torso: 180, ...legs(3, -3), ...both(15, 70) },
      { torso: 180, ...legs(0, 0), ...both(15, 60), footN: 30, footF: 30, lift: 4 },
    ],
  },
  boxing: {
    id: 'boxing',
    view: 'side',
    tempoMs: 1600,
    anchor: { joint: 'ankleF' },
    keys: [
      {
        torso: 172,
        thighN: 15,
        shinN: 0,
        thighF: -15,
        shinF: -5,
        armN: 30,
        foreN: 160,
        armF: 20,
        foreF: 165,
      },
      {
        torso: 168,
        thighN: 15,
        shinN: 0,
        thighF: -15,
        shinF: -5,
        armN: 90,
        foreN: 90,
        armF: 20,
        foreF: 165,
      },
      {
        torso: 172,
        thighN: 15,
        shinN: 0,
        thighF: -15,
        shinF: -5,
        armN: 30,
        foreN: 160,
        armF: 20,
        foreF: 165,
      },
      {
        torso: 165,
        thighN: 15,
        shinN: 0,
        thighF: -15,
        shinF: -5,
        armN: 30,
        foreN: 160,
        armF: 90,
        foreF: 90,
        footF: 40,
      },
    ],
  },
  'overhead-press': {
    id: 'overhead-press',
    view: 'side',
    tempoMs: 2400,
    ...foot,
    keys: [
      { ...STAND, ...both(25, 170) },
      { ...STAND, ...both(176, 178) },
    ],
  },
  curl: {
    id: 'curl',
    view: 'side',
    tempoMs: 2200,
    ...foot,
    keys: [
      { ...STAND, ...both(0, 5) },
      { ...STAND, ...both(5, 150) },
    ],
  },
  'triceps-extension': {
    id: 'triceps-extension',
    view: 'side',
    tempoMs: 2400,
    ...foot,
    keys: [
      { ...STAND, ...both(172, -20) },
      { ...STAND, ...both(172, 176) },
    ],
  },
  row: {
    id: 'row',
    view: 'side',
    tempoMs: 2200,
    ...foot,
    keys: [
      { torso: 115, ...legs(22, -10), ...both(0, 0) },
      { torso: 115, ...legs(22, -10), ...both(-65, 0) },
    ],
  },
  'standing-row': {
    id: 'standing-row',
    view: 'side',
    tempoMs: 2200,
    ...foot,
    keys: [
      { ...STAND, ...both(88, 90) },
      { ...STAND, ...both(-30, 90) },
    ],
  },
  'press-out': {
    id: 'press-out',
    view: 'side',
    tempoMs: 3000,
    ...foot,
    keys: [
      { ...STAND, ...legs(8, -8), ...both(10, 150) },
      { ...STAND, ...legs(8, -8), ...both(88, 90) },
    ],
  },
  'pull-up': {
    id: 'pull-up',
    view: 'side',
    tempoMs: 2600,
    anchor: { joint: 'handN', y: 10 },
    prop: 'bar',
    keys: [
      { torso: 180, ...legs(10, -30), ...both(180, 180) },
      { torso: 178, ...legs(20, -35), ...both(25, 175) },
    ],
  },
  'calf-raise': {
    id: 'calf-raise',
    view: 'side',
    tempoMs: 1600,
    anchor: { joint: 'ankleN' },
    keys: [
      { ...STAND, ...both(0, 0) },
      { ...STAND, ...both(0, 0), footN: 35, footF: 35 },
    ],
  },
};

/**
 * Catalogue slug → movement pattern. Exercises without a faithful pattern (rotations, wrist and
 * neck work, sport-specific ball skills) are left out: no animation rather than a misleading one.
 */
export const MOTION_BY_SLUG: Record<string, keyof typeof PATTERNS> = {
  'bodyweight-squat': 'squat',
  'box-squat': 'squat',
  'streamline-squat': 'squat',
  'goblet-squat': 'goblet-squat',
  'wall-sit': 'squat-hold',
  'low-stance-hold': 'athletic-stance',
  'reverse-lunge': 'lunge',
  'split-squat': 'split-squat',
  'hip-flexor-stretch': 'lunge-stretch',
  'db-rdl': 'hinge',
  'kb-deadlift': 'hinge',
  'hamstring-stretch': 'hamstring-stretch',
  'kb-swing': 'swing',
  'glute-bridge': 'bridge',
  'single-leg-glute-bridge': 'bridge',
  'hip-thrust': 'bridge',
  'standing-calf-raise': 'calf-raise',
  'push-up': 'push-up',
  'incline-push-up': 'push-up',
  'db-floor-press': 'floor-press',
  'one-arm-db-row': 'row',
  'bent-over-db-row': 'row',
  'band-row': 'standing-row',
  'band-pull-apart': 'pull-apart',
  'shoulder-band-series': 'pull-apart',
  'pull-up': 'pull-up',
  'db-shoulder-press': 'overhead-press',
  'lateral-raise': 'lateral-raise',
  'db-curl': 'curl',
  'overhead-triceps': 'triceps-extension',
  plank: 'plank',
  'side-plank': 'plank',
  'dead-bug': 'dead-bug',
  'bird-dog': 'bird-dog',
  'hollow-hold': 'hollow',
  'pallof-press': 'press-out',
  'suitcase-carry': 'walk',
  'cat-cow': 'cat-cow',
  'easy-walk': 'walk',
  'single-leg-balance': 'balance',
  'shadow-boxing': 'boxing',
  'mountain-climber': 'mountain-climber',
  'jumping-jack': 'jumping-jack',
  'jump-rope': 'jump-rope',
  burpee: 'burpee',
  'high-knees': 'high-knees',
  'a-skips': 'high-knees',
  'march-in-place': 'march',
  'leg-swings': 'leg-swing',
  'lateral-lunge': 'lateral-lunge',
  'walking-knee-hug': 'knee-hug',
  'arm-circles': 'arm-circles',
  'build-up-runs': 'run',
  strides: 'run',
  'acceleration-sprints': 'run',
  'closeout-sprints': 'run',
  'defensive-slides': 'shuffle',
  'change-of-direction': 'shuffle',
  'crossover-recovery-steps': 'shuffle',
  'split-step-reaction': 'quick-feet',
  'quick-feet': 'quick-feet',
  'footwork-box': 'quick-feet',
  'jump-stop-landing': 'jump',
  'block-jumps': 'jump',
  'lateral-bounds': 'skater',
  'skater-jumps': 'skater',
  'bear-crawl': 'bear-crawl',
  'flutter-kick-hold': 'flutter-kick',
};

const prepared = new Map<string, PreparedMotion>();

/** The prepared animation for an exercise, or null when it has none. */
export function motionFor(slug: string): PreparedMotion | null {
  const id = MOTION_BY_SLUG[slug];
  const pattern = id ? PATTERNS[id] : undefined;
  if (!pattern) return null;
  let p = prepared.get(pattern.id);
  if (!p) {
    p = prepareMotion(pattern);
    prepared.set(pattern.id, p);
  }
  return p;
}

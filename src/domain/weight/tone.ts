/** How a weight change relates to the user's goal, for arrows and colours (spec 13.3, 23.4). */
export interface ChangeTone {
  direction: 'down' | 'up' | 'flat';
  /** toward the goal (green), away from it (amber, never red: spec 23.4), or neutral. */
  tone: 'toward' | 'away' | 'neutral';
}

/** Changes smaller than this are shown as no change. */
export const FLAT_KG = 0.1;

/** Pure: lose-weight goals count a decrease as progress, muscle gain an increase; others neutral. */
export function changeTone(
  changeKg: number | null,
  goalType: string | null | undefined,
): ChangeTone {
  if (changeKg === null || !Number.isFinite(changeKg) || Math.abs(changeKg) < FLAT_KG)
    return { direction: 'flat', tone: 'neutral' };
  const direction = changeKg < 0 ? 'down' : 'up';
  if (goalType === 'lose_weight')
    return { direction, tone: direction === 'down' ? 'toward' : 'away' };
  if (goalType === 'build_muscle')
    return { direction, tone: direction === 'up' ? 'toward' : 'away' };
  return { direction, tone: 'neutral' };
}

/**
 * How far you've come and how far is left, for the Home progress line ("2.7 kg down · 15.3 kg to
 * go"). `toGo` is 0 once the target is reached and null without a target. Pure.
 */
export function goalJourney(startKg: number, currentKg: number, targetKg: number | null) {
  const moved = Math.abs(currentKg - startKg);
  const direction: 'down' | 'up' = currentKg <= startKg ? 'down' : 'up';
  if (targetKg === null) return { moved, direction, toGo: null };
  const losing = targetKg < startKg;
  const left = losing ? currentKg - targetKg : targetKg - currentKg;
  return { moved, direction, toGo: Math.max(0, left) };
}

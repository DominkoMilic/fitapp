/**
 * Two-weekly target recalibration (spec 8.9). Pure. Proposes, never applies: the user decides.
 */
import { addDays, dayNumber, type IsoDate } from '../calculations/dates';
import { observedTdee } from '../weight/trend';

export const RECAL = {
  windowDays: 21,
  minDaysBetweenChecks: 14,
  minDaysOnTarget: 21,
  minAdherence: 0.8,
  fastLossPctPerWeek: 1.0,
  slowShare: 0.5,
  increaseKcal: 150,
  decreaseKcal: 100,
  fatigueHold: 4,
} as const;

export type RecalReason =
  | 'increase_fast_loss'
  | 'decrease_slow'
  | 'on_track'
  | 'low_adherence'
  | 'recovery_hold'
  | 'not_enough_data';

/** A check runs when ≥ 14 days since the last one and ≥ 21 days on the current target. */
export function isCheckDue(input: {
  today: IsoDate;
  lastCheckOn: IsoDate | null;
  targetSince: IsoDate;
}): boolean {
  const since = (d: IsoDate) => dayNumber(input.today) - dayNumber(d);
  return (
    (input.lastCheckOn === null || since(input.lastCheckOn) >= RECAL.minDaysBetweenChecks) &&
    since(input.targetSince) >= RECAL.minDaysOnTarget
  );
}

export const checkWindow = (today: IsoDate) => ({
  start: addDays(today, -(RECAL.windowDays - 1)),
  end: today,
});

export interface RecalInput {
  currentKcal: number;
  floorKcal: number;
  /** Goal rate in kg/week of loss (e.g. 0.5 % × 108 kg = 0.54). */
  targetRateKgWeek: number;
  currentWeightKg: number;
  /** OLS trend over the window (kg/week, negative = loss); null when not enough data. */
  slopeKgPerWeek: number | null;
  /** Mean intake on complete days in the window; null when none. */
  meanIntakeKcal: number | null;
  /** Complete nutrition days ÷ days in the window. */
  adherence: number;
  /** The previous check was also slow. */
  previousSlow: boolean;
  /** Mean check-in fatigue (1–5) over the window; null when no check-ins. */
  avgFatigue: number | null;
}

export interface RecalResult {
  reason: RecalReason;
  proposedKcal: number | null;
  observedTdee: number | null;
  actualRateKgWeek: number | null;
  slow: boolean;
  /** Plain-language explanation for the review screen. */
  message: string;
}

export function recalibrate(i: RecalInput): RecalResult {
  const base = { proposedKcal: null, observedTdee: null, actualRateKgWeek: null, slow: false };
  if (i.adherence < RECAL.minAdherence) {
    return {
      ...base,
      reason: 'low_adherence',
      message: 'Log a few more full days so PACE can calibrate your target.',
    };
  }
  if (i.slopeKgPerWeek === null || i.meanIntakeKcal === null) {
    return {
      ...base,
      reason: 'not_enough_data',
      message:
        'Not enough weigh-ins yet to see a trend. Weigh in most mornings and PACE will check again.',
    };
  }
  const tdee = Math.round(observedTdee(i.meanIntakeKcal, i.slopeKgPerWeek) * 10) / 10;
  const rate = -i.slopeKgPerWeek; // positive = loss
  const slow = rate < RECAL.slowShare * i.targetRateKgWeek;
  const common = { observedTdee: tdee, actualRateKgWeek: rate, slow };

  if (rate > (RECAL.fastLossPctPerWeek / 100) * i.currentWeightKg) {
    return {
      ...common,
      reason: 'increase_fast_loss',
      proposedKcal: i.currentKcal + RECAL.increaseKcal,
      message: `You're losing ${rate.toFixed(2)} kg a week, faster than is comfortable to sustain. PACE suggests eating ${RECAL.increaseKcal} kcal more each day.`,
    };
  }
  if (slow && i.previousSlow) {
    if (i.avgFatigue !== null && i.avgFatigue >= RECAL.fatigueHold) {
      return {
        ...common,
        reason: 'recovery_hold',
        proposedKcal: null,
        message:
          "Progress has been slower than planned, but you've been tired lately. Keep your current target and prioritise sleep.",
      };
    }
    const proposed = Math.max(i.floorKcal, i.currentKcal - RECAL.decreaseKcal);
    if (proposed < i.currentKcal) {
      return {
        ...common,
        reason: 'decrease_slow',
        proposedKcal: proposed,
        message: `Progress has been slower than planned for two checks in a row. PACE suggests ${i.currentKcal - proposed} kcal less each day.`,
      };
    }
  }
  return {
    ...common,
    reason: 'on_track',
    proposedKcal: null,
    message: 'On track — keep your current target.',
  };
}

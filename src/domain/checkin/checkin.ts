/** Daily check-in (spec 1.4, 9.3). Pure. */
export interface CheckinValues {
  sleepHours: number | null;
  fatigue: number | null; // 1–5
  soreness: number | null; // 1–5
  pain: number | null; // 0–10
  painArea: string | null;
  note: string;
}

export const PAIN_REST_THRESHOLD = 4;

export type CheckinIssue =
  'sleep_range' | 'fatigue_range' | 'soreness_range' | 'pain_range' | 'pain_area_missing' | 'empty';

export function validateCheckin(v: CheckinValues): CheckinIssue[] {
  const issues: CheckinIssue[] = [];
  if (v.sleepHours !== null && (v.sleepHours < 0 || v.sleepHours > 24)) issues.push('sleep_range');
  if (v.fatigue !== null && (v.fatigue < 1 || v.fatigue > 5 || !Number.isInteger(v.fatigue)))
    issues.push('fatigue_range');
  if (v.soreness !== null && (v.soreness < 1 || v.soreness > 5 || !Number.isInteger(v.soreness)))
    issues.push('soreness_range');
  if (v.pain !== null && (v.pain < 0 || v.pain > 10 || !Number.isInteger(v.pain)))
    issues.push('pain_range');
  if (v.pain !== null && v.pain > 0 && !v.painArea) issues.push('pain_area_missing');
  if (
    v.sleepHours === null &&
    v.fatigue === null &&
    v.soreness === null &&
    v.pain === null &&
    !v.note.trim()
  )
    issues.push('empty');
  return issues;
}

/**
 * Safety guidance after a check-in (spec 3.1 #8, 9.3). Never diagnoses; never suggests training
 * through pain.
 */
export function checkinGuidance(
  v: CheckinValues,
): { tone: 'warning' | 'info'; message: string } | null {
  if (v.pain !== null && v.pain >= PAIN_REST_THRESHOLD) {
    return {
      tone: 'warning',
      message:
        'You reported pain of 4/10 or more. Rest that area today and skip exercises that load it. If the pain persists, worsens, or you have swelling, get it checked by a healthcare professional.',
    };
  }
  if ((v.fatigue !== null && v.fatigue >= 4) || (v.sleepHours !== null && v.sleepHours < 6)) {
    return {
      tone: 'info',
      message: "You're tired today. An easier or shorter session is a good choice.",
    };
  }
  return null;
}

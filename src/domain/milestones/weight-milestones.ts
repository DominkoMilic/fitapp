/**
 * Weight milestones generated from a goal (spec 14.2 / 25.5). Pure.
 * Unlocking (Phase 2) uses the 7-day average weight, never a single weigh-in.
 */
export interface WeightMilestone {
  key: string;
  title: string;
  /** Unlocks when the 7-day average is at or below this weight (kg). */
  thresholdKg: number;
}

const fmt = (kg: number) => (Number.isInteger(kg) ? String(kg) : kg.toFixed(1));

export function weightMilestones(input: {
  startKg: number;
  targetKg: number;
  secondaryTargetKg?: number | null;
}): WeightMilestone[] {
  const { startKg, targetKg } = input;
  if (!(targetKg < startKg)) return [];
  const lowest = Math.min(targetKg, input.secondaryTargetKg ?? targetKg);
  const out = new Map<string, WeightMilestone>();

  // Lost-kg milestones: 1, 3, 5, then every 5 kg, while still above the lowest target.
  const lostSteps = [1, 3, 5];
  for (let n = 10; startKg - n > lowest; n += 5) lostSteps.push(n);
  for (const n of lostSteps) {
    if (startKg - n <= lowest) continue;
    out.set(`weight_lost_${n}`, {
      key: `weight_lost_${n}`,
      title: n === 1 ? 'First 1 kg lost' : `${n} kg lost`,
      thresholdKg: startKg - n,
    });
  }

  // Round numbers (multiples of 5) crossed between start and the lowest target.
  for (let w = Math.floor((startKg - 0.0001) / 5) * 5; w > lowest; w -= 5) {
    out.set(`weight_reached_${w}`, {
      key: `weight_reached_${w}`,
      title: `${w} kg reached`,
      thresholdKg: w,
    });
  }

  out.set('goal_target', {
    key: 'goal_target',
    title: `Target reached: ${fmt(targetKg)} kg`,
    thresholdKg: targetKg,
  });
  if (input.secondaryTargetKg != null && input.secondaryTargetKg < targetKg) {
    out.set('goal_secondary', {
      key: 'goal_secondary',
      title: `Secondary target reached: ${fmt(input.secondaryTargetKg)} kg`,
      thresholdKg: input.secondaryTargetKg,
    });
  }

  // One celebration per weight: when thresholds coincide keep goal > kg-lost > round number.
  const priority = (key: string) =>
    key.startsWith('goal_') ? 0 : key.startsWith('weight_lost_') ? 1 : 2;
  const byThreshold = new Map<number, WeightMilestone>();
  for (const m of out.values()) {
    const t = Math.round(m.thresholdKg * 100) / 100;
    const existing = byThreshold.get(t);
    if (!existing || priority(m.key) < priority(existing.key)) byThreshold.set(t, m);
  }
  return [...byThreshold.values()].sort((a, b) => b.thresholdKg - a.thresholdKg);
}

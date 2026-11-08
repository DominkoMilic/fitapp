/** Body measurements (spec 13.5). Pure. Values are centimetres. */
export const MEASUREMENT_TYPES = [
  'waist',
  'hips',
  'chest',
  'neck',
  'arm_left',
  'arm_right',
  'thigh_left',
  'thigh_right',
  'calf_left',
  'calf_right',
] as const;
export type MeasurementType = (typeof MEASUREMENT_TYPES)[number];

export const MEASUREMENT_LABELS: Record<MeasurementType, string> = {
  waist: 'Waist',
  hips: 'Hips',
  chest: 'Chest',
  neck: 'Neck',
  arm_left: 'Left arm',
  arm_right: 'Right arm',
  thigh_left: 'Left thigh',
  thigh_right: 'Right thigh',
  calf_left: 'Left calf',
  calf_right: 'Right calf',
};

export const MEASUREMENT_RANGE_CM = { min: 10, max: 250 } as const;

export interface MeasurementLike {
  measurement_type: string;
  value_cm: number | string;
  local_date: string;
  measured_at: string;
}

export interface MeasurementSummary {
  type: MeasurementType;
  latestCm: number;
  latestDate: string;
  firstCm: number;
  changeCm: number | null;
  series: { date: string; cm: number }[];
}

/** Per-type latest value, change since the first entry, and a date series (latest per day). */
export function summarizeMeasurements(rows: readonly MeasurementLike[]): MeasurementSummary[] {
  const out: MeasurementSummary[] = [];
  for (const type of MEASUREMENT_TYPES) {
    const own = rows
      .filter((r) => r.measurement_type === type && Number.isFinite(Number(r.value_cm)))
      .sort((a, b) => a.measured_at.localeCompare(b.measured_at));
    if (!own.length) continue;
    const byDate = new Map<string, number>();
    for (const r of own) byDate.set(r.local_date, Number(r.value_cm)); // later entries win
    const series = [...byDate.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, cm]) => ({ date, cm }));
    const first = series[0]!;
    const last = series[series.length - 1]!;
    out.push({
      type,
      latestCm: last.cm,
      latestDate: last.date,
      firstCm: first.cm,
      changeCm: series.length > 1 ? last.cm - first.cm : null,
      series,
    });
  }
  return out;
}

export const isValidMeasurement = (cm: number) =>
  Number.isFinite(cm) && cm >= MEASUREMENT_RANGE_CM.min && cm <= MEASUREMENT_RANGE_CM.max;

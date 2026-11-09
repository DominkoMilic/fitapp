/**
 * Weekly report (spec 16). Pure. Every metric is null when there is no data, so the UI can say
 * "No data" instead of showing a misleading zero.
 */
import { addDays, type IsoDate } from '../calculations/dates';
import { type LoadSession, loadBetween } from '../coach/load';
import { type DailyValue, rollingAverageAt, trendLast21Days } from '../weight/trend';

export const REPORT_VERSION = 1;

export interface WeeklyReportInput {
  weekStart: IsoDate;
  today: IsoDate;
  daily: readonly DailyValue[];
  scheduled: readonly { date: IsoDate; status: string; category: string }[];
  sessions: readonly (LoadSession & { category: string })[];
  activities: readonly {
    date: IsoDate;
    type: string;
    distanceM: number | null;
    trusted: boolean;
  }[];
  /** Complete nutrition days with totals. */
  completeDays: readonly { date: IsoDate; kcal: number; proteinG: number }[];
  /** Water per day for days with any water logged. */
  waterDays: readonly { date: IsoDate; ml: number }[];
  milestones: readonly { date: IsoDate; title: string }[];
}

export interface WeeklyReport {
  version: number;
  weekStart: IsoDate;
  weekEnd: IsoDate;
  inProgress: boolean;
  weight: {
    startAvgKg: number | null;
    endAvgKg: number | null;
    changeKg: number | null;
    trendKgPerWeek: number | null;
    weighIns: number;
  };
  training: {
    planned: number;
    completed: number;
    completionPct: number | null;
    minutes: number | null;
    load: number | null;
  };
  activities: {
    count: number;
    walkKm: number | null;
    runKm: number | null;
    cycleKm: number | null;
  };
  nutrition: {
    completeDays: number;
    avgKcal: number | null;
    avgProteinG: number | null;
    /** "based on N of 7 days" */
    basedOn: string;
  };
  water: { avgMl: number | null; days: number };
  milestones: string[];
}

const r1 = (n: number) => Math.round(n * 10) / 10;
const r2 = (n: number) => Math.round(n * 100) / 100;
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export function weeklyReport(i: WeeklyReportInput): WeeklyReport {
  const start = i.weekStart;
  const end = addDays(start, 6);
  const inWeek = (d: IsoDate) => d >= start && d <= end;
  const lastDay = i.today < end ? i.today : end;

  const startAvg = rollingAverageAt(i.daily, start);
  const endAvg = rollingAverageAt(i.daily, lastDay);
  const trend = trendLast21Days(i.daily, lastDay);

  const sched = i.scheduled.filter((s) => inWeek(s.date) && s.status !== 'moved');
  const planned = sched.filter((s) => s.status !== 'skipped').length;
  const completed = sched.filter((s) => s.status === 'completed').length;
  const sessions = i.sessions.filter((s) => inWeek(s.date));
  const rated = sessions.filter((s) => s.rpe !== null);

  const acts = i.activities.filter((a) => inWeek(a.date));
  const km = (type: string) => {
    const list = acts.filter((a) => a.type === type && a.trusted && a.distanceM !== null);
    return list.length ? r2(list.reduce((a, x) => a + (x.distanceM ?? 0), 0) / 1000) : null;
  };

  const complete = i.completeDays.filter((d) => inWeek(d.date));
  const water = i.waterDays.filter((d) => inWeek(d.date) && d.ml > 0);
  const avgKcal = mean(complete.map((d) => d.kcal));
  const avgProtein = mean(complete.map((d) => d.proteinG));
  const avgWater = mean(water.map((d) => d.ml));

  return {
    version: REPORT_VERSION,
    weekStart: start,
    weekEnd: end,
    inProgress: i.today <= end,
    weight: {
      startAvgKg: startAvg === null ? null : r2(startAvg),
      endAvgKg: endAvg === null ? null : r2(endAvg),
      changeKg: startAvg !== null && endAvg !== null ? r2(endAvg - startAvg) : null,
      trendKgPerWeek: trend ? r2(trend.slopeKgPerWeek) : null,
      weighIns: i.daily.filter((d) => inWeek(d.date)).length,
    },
    training: {
      planned,
      completed,
      completionPct: planned ? Math.round((completed / planned) * 100) : null,
      minutes: sessions.length
        ? Math.round(sessions.reduce((a, s) => a + s.durationS, 0) / 60)
        : null,
      load: rated.length ? loadBetween(rated, start, end) : null,
    },
    activities: { count: acts.length, walkKm: km('walk'), runKm: km('run'), cycleKm: km('cycle') },
    nutrition: {
      completeDays: complete.length,
      avgKcal: avgKcal === null ? null : Math.round(avgKcal),
      avgProteinG: avgProtein === null ? null : r1(avgProtein),
      basedOn: `based on ${complete.length} of 7 days`,
    },
    water: { avgMl: avgWater === null ? null : Math.round(avgWater), days: water.length },
    milestones: i.milestones.filter((m) => inWeek(m.date)).map((m) => m.title),
  };
}

/** Local week start (Monday = 1 or Sunday = 7) containing `date`. */
export function weekStartFor(date: IsoDate, weekStartsOn: 1 | 7): IsoDate {
  const d = new Date(`${date}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  const iso = d === 0 ? 7 : d;
  const back = weekStartsOn === 1 ? iso - 1 : iso % 7;
  return addDays(date, -back);
}

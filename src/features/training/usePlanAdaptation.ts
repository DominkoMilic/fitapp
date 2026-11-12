import { useMemo } from 'react';

import { addDays } from '@/domain/calculations/dates';
import { type LoggedSession, suggestAdaptations } from '@/domain/training/adapt';
import { isSportCategory } from '@/domain/sports/catalogue';
import { useActivities } from '@/features/activity/api';
import { useAuth } from '@/features/auth/AuthProvider';
import { useToday } from '@/features/dashboard/useToday';

import { useAdaptDecisions } from './adapt-store';
import { toPlanRow, useScheduleActions, useScheduledWorkouts } from './schedule-api';
import { useSessions } from './session-api';

const ACTIVITY_TITLE: Record<string, string> = {
  run: 'your run',
  walk: 'your walk',
  cycle: 'your ride',
  other: 'your activity',
};

/**
 * Plan changes suggested after a session you logged that wasn't in the plan (2026-11-12). Nothing
 * changes until you tap Apply; Keep my plan declines. Both are remembered.
 */
export function usePlanAdaptation() {
  const userId = useAuth().session?.user.id;
  const { today } = useToday();
  const schedule = useScheduledWorkouts(addDays(today, -1), addDays(today, 3));
  const sessions = useSessions();
  const activities = useActivities();
  const handledKeys = useAdaptDecisions((s) => (userId ? s.byUser[userId] : undefined));
  const markHandled = useAdaptDecisions((s) => s.markHandled);
  const actions = useScheduleActions();

  const suggestion = useMemo(() => {
    if (!userId || !schedule.isSuccess) return null;
    const from = addDays(today, -1);
    const logged: LoggedSession[] = [
      // Sport sessions and other activities logged without a plan item.
      ...sessions.sessions
        .filter(
          (s) =>
            s.local_date >= from &&
            s.scheduled_workout_id === null &&
            s.template_slug === null &&
            (isSportCategory(s.category) || s.category === 'other'),
        )
        .map((s) => ({
          id: s.id,
          date: s.local_date,
          category: s.category,
          title: s.title,
          minutes: Math.round(s.duration_seconds / 60),
          rpe: s.perceived_exertion,
        })),
      // Recorded or added walks, runs and rides.
      ...activities.rows
        .filter((a) => a.local_date >= from)
        .map((a) => ({
          id: a.id,
          date: a.local_date,
          category: a.activity_type,
          title: ACTIVITY_TITLE[a.activity_type] ?? 'your activity',
          minutes: Math.round(a.moving_seconds / 60),
          rpe: null,
        })),
    ];
    return suggestAdaptations({
      logged,
      plan: schedule.rows.map(toPlanRow),
      today,
      handled: new Set(handledKeys ?? []),
    });
  }, [
    userId,
    schedule.isSuccess,
    schedule.rows,
    sessions.sessions,
    activities.rows,
    today,
    handledKeys,
  ]);

  const apply = async (keys: readonly string[]) => {
    if (!suggestion || !userId) return;
    const after = suggestion.session.title;
    for (const item of suggestion.items) {
      if (!keys.includes(item.key)) continue;
      const row = schedule.rows.find((r) => r.id === item.rowId);
      if (!row) continue;
      if (item.kind === 'skip') await actions.replaceBy(row, after);
      else if (item.toTemplateSlug) await actions.swapTemplate(row, item.toTemplateSlug, after);
    }
    markHandled(
      userId,
      suggestion.items.map((i) => i.key),
    );
  };
  const decline = () => {
    if (suggestion && userId)
      markHandled(
        userId,
        suggestion.items.map((i) => i.key),
      );
  };
  return { suggestion, apply, decline };
}

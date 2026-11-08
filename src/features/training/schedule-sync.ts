import type { PatternDayLike } from '@/domain/training/schedule';
import { generateOccurrences } from '@/domain/training/schedule';
import { parsePattern } from '@/features/dashboard/today';
import { requireSupabase } from '@/integrations/supabase/client';

const db = () => requireSupabase();

/**
 * Inserts the next 8 weeks of occurrences for the active plan and recurring events.
 * ON CONFLICT DO NOTHING on (user_id, occurrence_key): existing occurrences, including ones the
 * user moved, skipped or completed, are never touched (spec 10.2, 28.5 #4).
 */
export async function ensureSchedule(userId: string, today: string): Promise<number> {
  const [planRes, eventsRes, prefsRes] = await Promise.all([
    db()
      .from('training_plans')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle(),
    db().from('recurring_events').select('*').eq('user_id', userId),
    db()
      .from('user_preferences')
      .select('preferred_training_time')
      .eq('user_id', userId)
      .maybeSingle(),
  ]);
  if (planRes.error) throw planRes.error;
  if (eventsRes.error) throw eventsRes.error;
  const plan = planRes.data;
  const rows = generateOccurrences({
    planId: plan?.id ?? null,
    planStart: plan?.start_date ?? today,
    pattern: parsePattern(plan?.weekly_pattern) as PatternDayLike[],
    events: eventsRes.data ?? [],
    from: today,
    preferredTime: prefsRes.data?.preferred_training_time?.slice(0, 5) ?? null,
  });
  if (!rows.length) return 0;
  const { error } = await db()
    .from('scheduled_workouts')
    .upsert(
      rows.map((r) => ({ ...r, user_id: userId })),
      { onConflict: 'user_id,occurrence_key', ignoreDuplicates: true },
    );
  if (error) throw error;
  return rows.length;
}

/** Removes future, untouched occurrences so they can be regenerated after a plan/series change. */
export async function clearFutureGenerated(
  userId: string,
  today: string,
  filter: { planId?: string; eventId?: string },
) {
  let q = db()
    .from('scheduled_workouts')
    .delete()
    .eq('user_id', userId)
    .eq('status', 'planned')
    .eq('is_user_modified', false)
    .gte('scheduled_date', today);
  if (filter.planId) q = q.eq('training_plan_id', filter.planId).is('recurring_event_id', null);
  if (filter.eventId) q = q.eq('recurring_event_id', filter.eventId);
  const { error } = await q;
  if (error) throw error;
}

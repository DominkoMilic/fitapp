/**
 * Every table holding a user's data, with the column (or columns, any of which may match) that
 * identifies the owner (spec 19 data
 * export, 27 #18). A unit test checks this against the generated database types so a new user
 * table can't be forgotten.
 */
export const EXPORT_TABLES = [
  ['profiles', 'id'],
  ['user_goals', 'user_id'],
  ['user_preferences', 'user_id'],
  ['user_equipment', 'user_id'],
  ['health_conditions', 'user_id'],
  ['consents', 'user_id'],
  ['training_plans', 'user_id'],
  ['recurring_events', 'user_id'],
  ['scheduled_workouts', 'user_id'],
  ['workout_sessions', 'user_id'],
  ['exercise_sets', 'user_id'],
  ['exercises', 'owner_id'],
  ['weight_entries', 'user_id'],
  ['body_measurements', 'user_id'],
  ['daily_checkins', 'user_id'],
  ['user_milestones', 'user_id'],
  ['weekly_reports', 'user_id'],
  ['activities', 'user_id'],
  ['social_profiles', 'user_id'],
  ['social_settings', 'user_id'],
  // A friendship row belongs to both people; either column can hold the user.
  ['friendships', ['user_low', 'user_high']],
  ['blocks', 'blocker'],
  ['reports', 'reporter'],
  ['feed_items', 'owner'],
  ['cheers', 'user_id'],
  ['comments', 'author'],
] as const;

/**
 * Tables with a user column that aren't personal data: technical rate-limit counters, device push
 * tokens and push batching state.
 */
export const NOT_EXPORTED = ['edge_rate_limits', 'push_tokens', 'push_log'] as const;

export type ExportTable = (typeof EXPORT_TABLES)[number][0];

/** Unique per-user sort key for stable paging (tables without an `id` column). */
export const EXPORT_ORDER_KEY: Partial<Record<ExportTable, string | readonly string[]>> = {
  blocks: 'blocked',
  cheers: 'feed_item_id',
  daily_checkins: 'local_date',
  friendships: ['user_low', 'user_high'],
  social_profiles: 'user_id',
  social_settings: 'user_id',
  user_preferences: 'user_id',
};

/** The PostgREST `or` filter for owner columns, or null for a single column. */
export function ownerFilter(owner: string | readonly string[], userId: string): string | null {
  return typeof owner === 'string' ? null : owner.map((c) => `${c}.eq.${userId}`).join(',');
}

export function orderColumns(table: ExportTable): readonly string[] {
  const key = EXPORT_ORDER_KEY[table] ?? 'id';
  return typeof key === 'string' ? [key] : key;
}

export const EXPORT_PAGE = 1000;
export const EXPORT_FORMAT_VERSION = 1;

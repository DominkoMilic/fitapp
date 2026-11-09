/**
 * Every table holding a user's data, with the column that identifies the owner (spec 19 data
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
  ['nutrition_targets', 'user_id'],
  ['target_adjustments', 'user_id'],
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
  ['foods', 'owner_id'],
  ['meal_log_items', 'user_id'],
  ['water_logs', 'user_id'],
  ['day_log_status', 'user_id'],
  ['saved_meals', 'user_id'],
  ['recipes', 'owner_id'],
  ['saved_recipes', 'user_id'],
  ['meal_plan_entries', 'user_id'],
  ['shopping_lists', 'user_id'],
  ['shopping_list_items', 'user_id'],
] as const;

/** Tables with a user column that aren't personal data (technical rate-limit counters). */
export const NOT_EXPORTED = ['edge_rate_limits'] as const;

export type ExportTable = (typeof EXPORT_TABLES)[number][0];

/** Unique per-user sort key for stable paging (tables without an `id` column). */
export const EXPORT_ORDER_KEY: Partial<Record<ExportTable, string>> = {
  daily_checkins: 'local_date',
  day_log_status: 'local_date',
  saved_recipes: 'recipe_id',
  user_preferences: 'user_id',
};

export const EXPORT_PAGE = 1000;
export const EXPORT_FORMAT_VERSION = 1;

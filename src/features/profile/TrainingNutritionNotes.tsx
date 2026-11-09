import { Banner } from '@/components/feedback';
import { Text } from '@/components/ui';
import { FREQUENT_TRAINING, HYDRATION_ML_PER_TRAINING_HOUR } from '@/constants/safety';
import type { NutritionPlan } from '@/domain/calculations/plan';

/** Guidance for people who train a lot (spec 8.4, 8.6, 8.7). Information only. */
export function TrainingNutritionNotes({
  plan,
  carbsG,
}: {
  plan: NutritionPlan;
  /** The carbohydrate target actually shown (it may have been edited). */
  carbsG: number;
}) {
  const t = plan.inputs.training;
  const lowCarbs =
    plan.sportCarbs !== null &&
    t !== undefined &&
    t.playsSport &&
    t.sessionsPerWeek >= 3 &&
    carbsG < plan.sportCarbs.suggestedMinG;
  return (
    <>
      {plan.calories.frequentTrainingCap ? (
        <Banner
          tone="info"
          message={`You train hard ${t?.hardSessionsPerWeek ?? FREQUENT_TRAINING.hardSessionsPerWeek} times a week, so the daily deficit is limited to ${FREQUENT_TRAINING.maxDeficitKcal} kcal. Eating too little while training this much hurts recovery, performance and health.`}
        />
      ) : null}
      {lowCarbs && plan.sportCarbs ? (
        <Banner
          tone="info"
          message={`Sport guidance suggests about ${plan.sportCarbs.suggestedMinG} g of carbohydrate or more on training days (3 g per kg). Your target is ${carbsG} g. On game and practice days, eat more carbohydrate around training, or choose a slower rate.`}
        />
      ) : null}
      {t && t.sessionsPerWeek > 0 ? (
        <Text variant="caption" color="textSecondary">
          On training days, drink roughly {HYDRATION_ML_PER_TRAINING_HOUR} ml extra per hour of
          training, more in heat.
        </Text>
      ) : null}
    </>
  );
}

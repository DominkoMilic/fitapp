import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { targetsFromEditedCalories } from '@/domain/calculations/targets';
import { useAuth } from '@/features/auth/AuthProvider';
import { profileKeys, type NutritionTarget } from '@/features/profile/api';
import { requireSupabase } from '@/integrations/supabase/client';
import type { Json, Tables, TablesInsert } from '@/integrations/supabase/database.types';

export type TargetAdjustment = Tables<'target_adjustments'>;

const db = () => requireSupabase();
export const coachKeys = {
  adjustments: (uid: string) => ['coach', uid, 'adjustments'] as const,
  range: (uid: string, from: string, to: string) =>
    ['coach', uid, 'nutrition-range', from, to] as const,
};

export interface DayTotals {
  date: string;
  kcal: number;
  proteinG: number;
}

/**
 * Nutrition per day over a range: complete days with totals (spec 8.9 adherence, 16 averages),
 * water per day, and every date with any food or water logged (logging streak).
 */
export function useNutritionRange(from: string, to: string) {
  const userId = useAuth().session?.user.id;
  return useQuery({
    queryKey: coachKeys.range(userId ?? 'anonymous', from, to),
    enabled: !!userId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const [status, items, water] = await Promise.all([
        db()
          .from('day_log_status')
          .select('local_date')
          .eq('user_id', userId as string)
          .eq('nutrition_complete', true)
          .gte('local_date', from)
          .lte('local_date', to),
        db()
          .from('meal_log_items')
          .select('local_date, kcal, protein_g')
          .eq('user_id', userId as string)
          .gte('local_date', from)
          .lte('local_date', to)
          .limit(5000),
        db()
          .from('water_logs')
          .select('local_date, amount_ml')
          .eq('user_id', userId as string)
          .gte('local_date', from)
          .lte('local_date', to)
          .limit(5000),
      ]);
      for (const r of [status, items, water]) if (r.error) throw r.error;
      const byDay = new Map<string, DayTotals>();
      for (const i of items.data ?? []) {
        const d = byDay.get(i.local_date) ?? { date: i.local_date, kcal: 0, proteinG: 0 };
        d.kcal += Number(i.kcal ?? 0);
        d.proteinG += Number(i.protein_g ?? 0);
        byDay.set(i.local_date, d);
      }
      const complete = new Set((status.data ?? []).map((s) => s.local_date));
      const waterByDay = new Map<string, number>();
      for (const w of water.data ?? [])
        waterByDay.set(w.local_date, (waterByDay.get(w.local_date) ?? 0) + w.amount_ml);
      return {
        completeDays: [...complete]
          .sort()
          .map((date) => byDay.get(date) ?? { date, kcal: 0, proteinG: 0 }),
        waterDays: [...waterByDay].map(([date, ml]) => ({ date, ml })),
        loggedDates: [...new Set([...byDay.keys(), ...waterByDay.keys()])],
      };
    },
  });
}

export function useAdjustments() {
  const userId = useAuth().session?.user.id;
  return useQuery({
    queryKey: coachKeys.adjustments(userId ?? 'anonymous'),
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await db()
        .from('target_adjustments')
        .select('*')
        .eq('user_id', userId as string)
        .order('window_end', { ascending: false })
        .limit(52);
      if (error) throw error;
      return data;
    },
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  const userId = useAuth().session?.user.id ?? 'anonymous';
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: coachKeys.adjustments(userId) }),
      qc.invalidateQueries({ queryKey: profileKeys.all }),
    ]);
}

/** Records one recalibration check. A second check for the same day is ignored (unique). */
export function useRecordCheck() {
  const userId = useAuth().session?.user.id;
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (row: Omit<TablesInsert<'target_adjustments'>, 'user_id'>) => {
      const { error } = await db()
        .from('target_adjustments')
        .upsert(
          { ...row, user_id: userId as string },
          {
            onConflict: 'user_id,window_end',
            ignoreDuplicates: true,
          },
        );
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useDecideAdjustment() {
  const invalidate = useInvalidate();
  return {
    reject: useMutation({
      mutationFn: async (id: string) => {
        const { error } = await db()
          .from('target_adjustments')
          .update({ status: 'rejected', decided_at: new Date().toISOString() })
          .eq('id', id);
        if (error) throw error;
      },
      onSuccess: invalidate,
    }),
    /** New target effective tomorrow: same protein and fat, carbs absorb the change (spec 8.9 #5). */
    accept: useMutation({
      mutationFn: async (v: {
        adjustment: TargetAdjustment;
        current: NutritionTarget;
        effectiveFrom: string;
        weightKg: number;
      }) => {
        const kcal = v.adjustment.proposed_kcal as number;
        const t = targetsFromEditedCalories({
          kcal,
          proteinG: v.current.protein_g,
          fatG: v.current.fat_g,
          referenceWeightKg: v.weightKg,
        });
        const target = {
          effective_from: v.effectiveFrom,
          kcal: t.kcal,
          protein_g: t.proteinG,
          carbs_g: t.carbsG,
          fat_g: t.fatG,
          fibre_g: t.fibreG,
          water_ml: v.current.water_ml,
          bmr: v.current.bmr,
          tdee: v.current.tdee,
          floor_kcal: v.current.floor_kcal,
          limited_by_floor: v.current.floor_kcal !== null && kcal <= v.current.floor_kcal,
          calculation_version: 'recalibration-1',
          calculation_inputs: {
            ...((v.current.calculation_inputs as Record<string, Json>) ?? {}),
            recalibratedFrom: v.current.kcal,
            observedTdee: v.adjustment.observed_tdee,
          },
        };
        const { error } = await db().rpc('accept_target_adjustment', {
          p_adjustment_id: v.adjustment.id,
          p_target: target as unknown as Json,
        });
        if (error) throw error;
      },
      onSuccess: invalidate,
    }),
  };
}

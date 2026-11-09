import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/AuthProvider';
import { requireSupabase } from '@/integrations/supabase/client';

import { profileKeys, usePreferences } from './api';

/**
 * Optional parts of PACE the user can switch off (Settings → App features). While preferences
 * load, everything counts as on, so nothing flickers away for the default (on) case.
 */
export function useFeatures() {
  const prefs = usePreferences();
  return {
    nutrition: prefs.data?.nutrition_enabled ?? true,
    loaded: prefs.isSuccess,
  };
}

/** Switch nutrition on or off. Nothing is deleted; targets keep being calculated. */
export function useSetNutritionEnabled() {
  const userId = useAuth().session?.user.id;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (on: boolean) => {
      if (!userId) throw new Error('Not signed in');
      const { error } = await requireSupabase()
        .from('user_preferences')
        .update({ nutrition_enabled: on })
        .eq('user_id', userId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: profileKeys.all }),
  });
}

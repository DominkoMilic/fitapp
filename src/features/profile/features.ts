import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/AuthProvider';
import { requireSupabase } from '@/integrations/supabase/client';

import { profileKeys, usePreferences } from './api';

/**
 * Optional parts of PACE the user can switch on or off (Settings → App features). While
 * preferences load, each counts as its default (nutrition on, social off), so nothing flickers.
 */
export function useFeatures() {
  const prefs = usePreferences();
  return {
    nutrition: prefs.data?.nutrition_enabled ?? true,
    social: prefs.data?.social_enabled ?? false,
    loaded: prefs.isSuccess,
  };
}

/**
 * At most five tabs (spec 33.5): with nutrition and social both on, Profile leaves the tab bar and
 * opens from the Home header instead.
 */
export function profileTabShown(f: { nutrition: boolean; social: boolean }): boolean {
  return !(f.nutrition && f.social);
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

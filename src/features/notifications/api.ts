import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { NotificationPrefs } from '@/domain/notifications/planner';
import { useAuth } from '@/features/auth/AuthProvider';
import { profileKeys } from '@/features/profile/api';
import { requireSupabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/database.types';

export function useSaveNotificationPrefs() {
  const userId = useAuth().session?.user.id;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (prefs: NotificationPrefs) => {
      const { error } = await requireSupabase()
        .from('user_preferences')
        .upsert({
          user_id: userId as string,
          notification_preferences: prefs as unknown as { [key: string]: Json },
        });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: profileKeys.all }),
  });
}

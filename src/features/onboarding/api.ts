import { useMutation, useQueryClient } from '@tanstack/react-query';

import { requireSupabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/database.types';
import { profileKeys } from '@/features/profile/api';

import type { OnboardingPayload } from './payload';

export function useCompleteOnboarding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: OnboardingPayload) => {
      const { error } = await requireSupabase().rpc('complete_onboarding', {
        payload: payload as unknown as Json,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: profileKeys.all }),
  });
}

/** Turns database errors into messages a user can act on. */
export function onboardingErrorMessage(error: unknown): string {
  const message =
    error && typeof error === 'object' && 'message' in error ? String(error.message) : '';
  if (/18 and over|BMI|above 1%|Terms and privacy|explicit consent/.test(message)) return message;
  if (/already completed/.test(message))
    return 'Your plan is already saved. Reopen the app to continue.';
  if (/network|fetch/i.test(message))
    return "You're offline. Your answers are saved on this phone; try again when you're connected.";
  return "We couldn't save your plan. Your answers are kept on this phone; please try again.";
}

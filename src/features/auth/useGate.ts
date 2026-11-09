import { envResult } from '@/config/env';
import { useProfile } from '@/features/profile/api';

import { useAuth } from './AuthProvider';
import { type GateState, resolveGate } from './gate';

export function useGate(): GateState & { retry: () => void } {
  const { initializing, session } = useAuth();
  const profile = useProfile();
  const state = resolveGate({
    configOk: envResult.ok,
    initializing,
    hasSession: !!session,
    profileStatus: profile.isPending ? 'pending' : profile.isError ? 'error' : 'success',
    onboarded: !!profile.data?.onboarding_completed_at,
    profileMissing: profile.isSuccess && profile.data === null,
  });
  return { ...state, retry: () => void profile.refetch() };
}

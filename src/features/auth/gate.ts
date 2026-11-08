/**
 * Decides where the app should be (spec 6.1). Pure, so the rules are unit tested.
 * With email confirmation enabled, Supabase only issues sessions to confirmed users,
 * so "signed in" implies "verified".
 */
export type GateState =
  | { kind: 'config_error' }
  | { kind: 'loading' }
  | { kind: 'profile_error' }
  | { kind: 'route'; href: '/welcome' | '/onboarding' | '/home' };

export function resolveGate(input: {
  configOk: boolean;
  initializing: boolean;
  hasSession: boolean;
  profileStatus: 'pending' | 'error' | 'success';
  onboarded: boolean;
}): GateState {
  if (!input.configOk) return { kind: 'config_error' };
  if (input.initializing) return { kind: 'loading' };
  if (!input.hasSession) return { kind: 'route', href: '/welcome' };
  if (input.profileStatus === 'pending') return { kind: 'loading' };
  if (input.profileStatus === 'error') return { kind: 'profile_error' };
  return { kind: 'route', href: input.onboarded ? '/home' : '/onboarding' };
}

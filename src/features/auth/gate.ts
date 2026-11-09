/**
 * Decides where the app should be (spec 6.1). Pure, so the rules are unit tested.
 * With email confirmation enabled, Supabase only issues sessions to confirmed users,
 * so "signed in" implies "verified".
 */
export type GateState =
  | { kind: 'config_error' }
  | { kind: 'loading' }
  | { kind: 'profile_error' }
  /** Signed in, but the account no longer exists (deleted on another device; spec 28.1 #8). */
  | { kind: 'account_missing' }
  | { kind: 'route'; href: '/welcome' | '/onboarding' | '/home' };

export function resolveGate(input: {
  configOk: boolean;
  initializing: boolean;
  hasSession: boolean;
  profileStatus: 'pending' | 'error' | 'success';
  onboarded: boolean;
  /** Profile loaded but no row: every account has one (created by a trigger at sign-up). */
  profileMissing?: boolean;
}): GateState {
  if (!input.configOk) return { kind: 'config_error' };
  if (input.initializing) return { kind: 'loading' };
  if (!input.hasSession) return { kind: 'route', href: '/welcome' };
  if (input.profileStatus === 'pending') return { kind: 'loading' };
  if (input.profileStatus === 'error') return { kind: 'profile_error' };
  if (input.profileMissing) return { kind: 'account_missing' };
  return { kind: 'route', href: input.onboarded ? '/home' : '/onboarding' };
}

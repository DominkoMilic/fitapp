/**
 * Maps Supabase Auth errors to user-facing messages. Pure, so it can be unit tested.
 * Messages never reveal whether an email address is registered (spec 28.1 #1).
 */
export interface AuthErrorLike {
  code?: string | null;
  status?: number | null;
  message?: string | null;
  name?: string | null;
}

export type AuthErrorKind =
  | 'invalid_credentials'
  | 'email_not_confirmed'
  | 'weak_password'
  | 'rate_limited'
  | 'link_expired'
  | 'same_password'
  | 'network'
  | 'unknown';

export interface FriendlyAuthError {
  kind: AuthErrorKind;
  message: string;
  retryable: boolean;
}

const MESSAGES: Record<AuthErrorKind, string> = {
  invalid_credentials: 'Email or password is incorrect.',
  email_not_confirmed: 'Please confirm your email address first. We can send the link again.',
  weak_password: 'Choose a stronger password: at least 8 characters with letters and numbers.',
  rate_limited: 'Too many attempts. Please wait a minute and try again.',
  link_expired: 'This link has expired or was already used. Request a new one.',
  same_password: 'Your new password must be different from the current one.',
  network: "You're offline or the server can't be reached. Check your connection and try again.",
  unknown: 'Something went wrong. Please try again.',
};

export function classifyAuthError(error: AuthErrorLike): AuthErrorKind {
  const code = error.code ?? '';
  const message = (error.message ?? '').toLowerCase();
  if (code === 'invalid_credentials' || message.includes('invalid login credentials'))
    return 'invalid_credentials';
  if (code === 'email_not_confirmed' || message.includes('email not confirmed'))
    return 'email_not_confirmed';
  if (code === 'weak_password' || message.includes('password should')) return 'weak_password';
  if (code === 'same_password') return 'same_password';
  if (
    code.startsWith('over_') ||
    code === 'over_request_rate_limit' ||
    error.status === 429 ||
    message.includes('rate limit')
  ) {
    return 'rate_limited';
  }
  if (
    code === 'otp_expired' ||
    code === 'flow_state_expired' ||
    code === 'flow_state_not_found' ||
    code === 'bad_code_verifier' ||
    message.includes('expired')
  ) {
    return 'link_expired';
  }
  if (
    error.name === 'AuthRetryableFetchError' ||
    message.includes('network request failed') ||
    message.includes('failed to fetch')
  ) {
    return 'network';
  }
  return 'unknown';
}

export function toFriendlyAuthError(error: AuthErrorLike): FriendlyAuthError {
  const kind = classifyAuthError(error);
  return {
    kind,
    message: MESSAGES[kind],
    retryable: kind === 'network' || kind === 'rate_limited' || kind === 'unknown',
  };
}

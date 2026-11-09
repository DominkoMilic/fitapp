import { parseAuthCallback } from '@/features/auth/deep-link';
import { classifyAuthError, toFriendlyAuthError } from '@/features/auth/errors';
import { resolveGate } from '@/features/auth/gate';

describe('auth error mapping', () => {
  it.each([
    [{ code: 'invalid_credentials', message: 'Invalid login credentials' }, 'invalid_credentials'],
    [{ message: 'Email not confirmed' }, 'email_not_confirmed'],
    [{ code: 'weak_password' }, 'weak_password'],
    [{ code: 'over_email_send_rate_limit' }, 'rate_limited'],
    [{ status: 429, message: 'Too many' }, 'rate_limited'],
    [{ code: 'otp_expired' }, 'link_expired'],
    [{ code: 'flow_state_not_found' }, 'link_expired'],
    [{ name: 'AuthRetryableFetchError', message: 'Network request failed' }, 'network'],
    [{ code: 'same_password' }, 'same_password'],
    [{ message: 'boom' }, 'unknown'],
  ])('%j → %s', (error, kind) => expect(classifyAuthError(error)).toBe(kind));

  it('never mentions whether an account exists', () => {
    const all = [
      'invalid_credentials',
      'user_already_exists',
      'email_exists',
      'user_not_found',
    ].map((code) => toFriendlyAuthError({ code }).message.toLowerCase());
    for (const m of all) {
      expect(m).not.toMatch(/already (registered|exists)|no account|not found/);
    }
  });

  it('marks network errors as retryable', () => {
    expect(toFriendlyAuthError({ name: 'AuthRetryableFetchError' }).retryable).toBe(true);
    expect(toFriendlyAuthError({ code: 'invalid_credentials' }).retryable).toBe(false);
  });
});

describe('auth callback parsing', () => {
  it('PKCE code with next', () => {
    expect(parseAuthCallback('pace://auth/callback?next=reset-password&code=abc')).toEqual({
      kind: 'code',
      code: 'abc',
      next: 'reset-password',
    });
  });
  it('token hash link', () => {
    expect(parseAuthCallback('pace://auth/callback?token_hash=h1&type=signup')).toEqual({
      kind: 'token_hash',
      tokenHash: 'h1',
      type: 'signup',
      next: null,
    });
  });
  it('implicit-flow fragment tokens', () => {
    expect(
      parseAuthCallback('pace://auth/callback#access_token=a&refresh_token=r&type=recovery'),
    ).toMatchObject({
      kind: 'tokens',
      accessToken: 'a',
      refreshToken: 'r',
    });
  });
  it('expired link error in the fragment', () => {
    expect(
      parseAuthCallback(
        'pace://auth/callback#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired',
      ),
    ).toEqual({
      kind: 'error',
      code: 'otp_expired',
      message: 'Email link is invalid or has expired',
    });
  });
  it('unknown otp types and empty links are rejected', () => {
    expect(parseAuthCallback('pace://auth/callback?token_hash=h&type=evil').kind).toBe('none');
    expect(parseAuthCallback('pace://auth/callback').kind).toBe('none');
  });
  it('ignores malformed percent-encoding', () => {
    expect(parseAuthCallback('pace://auth/callback?%E0%A4%A=1&code=ok')).toMatchObject({
      kind: 'code',
      code: 'ok',
    });
  });
});

describe('routing gate (spec 6.1)', () => {
  const base = {
    configOk: true,
    initializing: false,
    hasSession: true,
    profileStatus: 'success' as const,
    onboarded: true,
  };
  it('config errors win', () =>
    expect(resolveGate({ ...base, configOk: false })).toEqual({ kind: 'config_error' }));
  it('waits for the stored session', () =>
    expect(resolveGate({ ...base, initializing: true })).toEqual({ kind: 'loading' }));
  it('signed out → welcome', () =>
    expect(resolveGate({ ...base, hasSession: false })).toEqual({
      kind: 'route',
      href: '/welcome',
    }));
  it('waits for the profile', () =>
    expect(resolveGate({ ...base, profileStatus: 'pending' })).toEqual({ kind: 'loading' }));
  it('profile load error', () =>
    expect(resolveGate({ ...base, profileStatus: 'error' })).toEqual({ kind: 'profile_error' }));
  it('not onboarded → onboarding', () =>
    expect(resolveGate({ ...base, onboarded: false })).toEqual({
      kind: 'route',
      href: '/onboarding',
    }));
  it('onboarded → home', () => expect(resolveGate(base)).toEqual({ kind: 'route', href: '/home' }));
});

describe('deleted account (spec 28.1 #8)', () => {
  it('signed in without a profile row → account_missing, not onboarding', () => {
    expect(
      resolveGate({
        configOk: true,
        initializing: false,
        hasSession: true,
        profileStatus: 'success',
        onboarded: false,
        profileMissing: true,
      }),
    ).toEqual({ kind: 'account_missing' });
  });
});

/**
 * Parses an auth callback URL (email confirmation or password reset).
 * Supports the PKCE flow (?code=), token-hash links (?token_hash=&type=), the implicit flow
 * (#access_token=&refresh_token=) and error redirects (?error_description= or #error_description=).
 */
export type AuthCallback =
  | { kind: 'code'; code: string; next: string | null }
  | { kind: 'token_hash'; tokenHash: string; type: OtpType; next: string | null }
  | { kind: 'tokens'; accessToken: string; refreshToken: string; next: string | null }
  | { kind: 'error'; message: string; code: string | null }
  | { kind: 'none' };

export type OtpType = 'signup' | 'recovery' | 'email' | 'email_change' | 'invite' | 'magiclink';
const OTP_TYPES: readonly OtpType[] = [
  'signup',
  'recovery',
  'email',
  'email_change',
  'invite',
  'magiclink',
];

function parseParams(part: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const pair of part.split('&')) {
    if (!pair) continue;
    const [rawKey, ...rest] = pair.split('=');
    if (!rawKey) continue;
    try {
      out[decodeURIComponent(rawKey)] = decodeURIComponent(rest.join('=').replace(/\+/g, ' '));
    } catch {
      // Ignore malformed pairs.
    }
  }
  return out;
}

export function parseAuthCallback(url: string): AuthCallback {
  const hashIndex = url.indexOf('#');
  const beforeHash = hashIndex >= 0 ? url.slice(0, hashIndex) : url;
  const hash = hashIndex >= 0 ? url.slice(hashIndex + 1) : '';
  const queryIndex = beforeHash.indexOf('?');
  const query = queryIndex >= 0 ? beforeHash.slice(queryIndex + 1) : '';
  const params = { ...parseParams(query), ...parseParams(hash) };
  const next = params.next ?? null;

  if (params.error || params.error_description || params.error_code) {
    return {
      kind: 'error',
      message: params.error_description ?? params.error ?? 'The link could not be used.',
      code: params.error_code ?? null,
    };
  }
  if (params.code) return { kind: 'code', code: params.code, next };
  if (params.token_hash && params.type && (OTP_TYPES as readonly string[]).includes(params.type)) {
    return { kind: 'token_hash', tokenHash: params.token_hash, type: params.type as OtpType, next };
  }
  if (params.access_token && params.refresh_token) {
    return {
      kind: 'tokens',
      accessToken: params.access_token,
      refreshToken: params.refresh_token,
      next,
    };
  }
  return { kind: 'none' };
}

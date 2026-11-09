/**
 * Parses an auth callback URL (email confirmation or password reset).
 * Supports the PKCE flow (?code=), token-hash links (?token_hash=&type=) and error redirects.
 *
 * Security (audit): raw session tokens in a link (#access_token=&refresh_token=) are NOT accepted.
 * Anyone can craft such a link with their own tokens and sign a victim into the attacker's
 * account ("login CSRF"), so the victim's health data would be saved there. The app uses PKCE.
 * Error text from the link is never shown verbatim (it could say anything); known codes are mapped
 * to our own wording.
 */
export type AuthCallback =
  | { kind: 'code'; code: string; next: string | null }
  | { kind: 'token_hash'; tokenHash: string; type: OtpType; next: string | null }
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

const ERROR_MESSAGES: Record<string, string> = {
  otp_expired: 'This link has expired. Request a new one.',
  access_denied: 'This link is invalid or has expired.',
  flow_state_not_found: 'This link was opened on a different device or has expired.',
};

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
    const code = params.error_code ?? params.error ?? null;
    return {
      kind: 'error',
      message: (code && ERROR_MESSAGES[code]) ?? 'This link is invalid or has expired.',
      code,
    };
  }
  if (params.code) return { kind: 'code', code: params.code, next };
  if (params.token_hash && params.type && (OTP_TYPES as readonly string[]).includes(params.type)) {
    return { kind: 'token_hash', tokenHash: params.token_hash, type: params.type as OtpType, next };
  }
  return { kind: 'none' };
}

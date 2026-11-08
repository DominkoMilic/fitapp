import { parseEnv } from '@/config/env';

describe('parseEnv', () => {
  it('accepts a complete configuration', () => {
    const r = parseEnv({
      EXPO_PUBLIC_APP_ENV: 'production',
      EXPO_PUBLIC_SUPABASE_URL: 'https://abc.supabase.co',
      EXPO_PUBLIC_SUPABASE_ANON_KEY: 'sb_publishable_1234567890abcdef',
    });
    expect(r.ok).toBe(true);
  });

  it('reports missing Supabase values', () => {
    const r = parseEnv({});
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.length).toBeGreaterThanOrEqual(2);
  });

  it('rejects unknown app environments', () => {
    const r = parseEnv({
      EXPO_PUBLIC_APP_ENV: 'staging-x',
      EXPO_PUBLIC_SUPABASE_URL: 'https://abc.supabase.co',
      EXPO_PUBLIC_SUPABASE_ANON_KEY: 'sb_publishable_1234567890abcdef',
    });
    expect(r.ok).toBe(false);
  });
});

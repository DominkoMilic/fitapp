import { z } from 'zod';

/**
 * Runtime environment, validated once at startup.
 * EXPO_PUBLIC_* variables must be referenced statically (process.env.EXPO_PUBLIC_X)
 * so the bundler can inline them.
 */
const envSchema = z
  .object({
    appEnv: z.enum(['development', 'preview', 'production']),
    supabaseUrl: z.url({ message: 'EXPO_PUBLIC_SUPABASE_URL must be a valid URL' }),
    supabaseAnonKey: z.string().min(20, 'EXPO_PUBLIC_SUPABASE_ANON_KEY is missing'),
    legalVersion: z.string().min(1),
    /** Shown in the privacy policy and support screens. Required for production builds. */
    supportEmail: z
      .email({ message: 'EXPO_PUBLIC_SUPPORT_EMAIL must be an email address' })
      .optional(),
  })
  .refine((e) => e.appEnv !== 'production' || !!e.supportEmail, {
    message: 'EXPO_PUBLIC_SUPPORT_EMAIL is required for production builds',
  });

export type AppEnv = z.infer<typeof envSchema>;

export type EnvResult = { ok: true; env: AppEnv } | { ok: false; errors: string[] };

export function parseEnv(raw: Record<string, string | undefined>): EnvResult {
  const result = envSchema.safeParse({
    appEnv: raw.EXPO_PUBLIC_APP_ENV ?? 'development',
    supabaseUrl: raw.EXPO_PUBLIC_SUPABASE_URL ?? '',
    supabaseAnonKey: raw.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
    legalVersion: raw.EXPO_PUBLIC_LEGAL_VERSION ?? '2026-11-17',
    supportEmail: raw.EXPO_PUBLIC_SUPPORT_EMAIL || undefined,
  });
  if (result.success) return { ok: true, env: result.data };
  return { ok: false, errors: result.error.issues.map((i) => i.message) };
}

export const envResult: EnvResult = parseEnv({
  EXPO_PUBLIC_APP_ENV: process.env.EXPO_PUBLIC_APP_ENV,
  EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
  EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  EXPO_PUBLIC_LEGAL_VERSION: process.env.EXPO_PUBLIC_LEGAL_VERSION,
  EXPO_PUBLIC_SUPPORT_EMAIL: process.env.EXPO_PUBLIC_SUPPORT_EMAIL,
});

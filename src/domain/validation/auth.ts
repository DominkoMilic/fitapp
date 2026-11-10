import { z } from 'zod';

export const emailSchema = z
  .string()
  .trim()
  .min(1, 'Enter your email address')
  .pipe(z.email({ message: 'Enter a valid email address' }));

/** The rules a new password must meet (shown as a live checklist while typing). Pure. */
export function passwordChecks(password: string) {
  return {
    length: password.length >= 8,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    digit: /\d/.test(password),
  };
}
export type PasswordCheck = keyof ReturnType<typeof passwordChecks>;
export const PASSWORD_RULES: { key: PasswordCheck; label: string }[] = [
  { key: 'length', label: 'At least 8 characters' },
  { key: 'upper', label: 'An uppercase letter' },
  { key: 'lower', label: 'A lowercase letter' },
  { key: 'digit', label: 'A number' },
];

/**
 * New or changed passwords (supabase/config.toml: lower_upper_letters_digits). Signing in only
 * checks that a password was entered, so older, simpler passwords keep working.
 */
export const passwordSchema = z
  .string()
  .max(72, 'Use at most 72 characters')
  .refine((p) => passwordChecks(p).length, 'Use at least 8 characters')
  .refine((p) => passwordChecks(p).upper, 'Include an uppercase letter')
  .refine((p) => passwordChecks(p).lower, 'Include a lowercase letter')
  .refine((p) => passwordChecks(p).digit, 'Include a number');

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password'),
});

export const signUpSchema = z
  .object({ email: emailSchema, password: passwordSchema, confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z
  .object({ password: passwordSchema, confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });

export const changePasswordSchema = z
  .object({
    current: z.string().min(1, 'Enter your current password'),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  })
  .refine((v) => v.password !== v.current, {
    path: ['password'],
    message: 'Choose a password different from your current one',
  });

export type ChangePasswordValues = z.infer<typeof changePasswordSchema>;
export type SignInValues = z.infer<typeof signInSchema>;
export type SignUpValues = z.infer<typeof signUpSchema>;
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;

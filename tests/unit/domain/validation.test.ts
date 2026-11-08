import { signUpSchema } from '@/domain/validation/auth';
import {
  consentSchema,
  equipmentSchema,
  goalsSchema,
  personalSchema,
} from '@/domain/validation/onboarding';

const asOf = '2026-11-08';
const personal = {
  displayName: 'Dev',
  dateOfBirth: '2003-05-01',
  calcSex: 'male',
  heightCm: 187,
  weightKg: 108,
  unitSystem: 'metric',
  timezone: 'Europe/Zagreb',
};

describe('personal step', () => {
  it('accepts the seed profile', () =>
    expect(personalSchema(asOf).safeParse(personal).success).toBe(true));
  it('rejects users under 18', () => {
    const r = personalSchema(asOf).safeParse({ ...personal, dateOfBirth: '2008-11-09' });
    expect(r.success).toBe(false);
  });
  it('accepts users turning 18 today', () => {
    expect(personalSchema(asOf).safeParse({ ...personal, dateOfBirth: '2008-11-08' }).success).toBe(
      true,
    );
  });
  it('rejects out-of-range height and weight', () => {
    expect(personalSchema(asOf).safeParse({ ...personal, heightCm: 119 }).success).toBe(false);
    expect(personalSchema(asOf).safeParse({ ...personal, weightKg: 351 }).success).toBe(false);
  });
});

describe('goals step', () => {
  const ctx = { weightKg: 108, heightCm: 187 };
  const base = {
    goalType: 'lose_weight' as const,
    targetWeightKg: 90,
    secondaryTargetWeightKg: 87,
    weeklyRatePct: 0.5,
    rateWarningAccepted: false,
    targetDate: null,
    focusTags: ['futsal' as const],
  };
  it('accepts the seed goal', () => expect(goalsSchema(ctx).safeParse(base).success).toBe(true));
  it('target must be below current weight when losing', () => {
    expect(goalsSchema(ctx).safeParse({ ...base, targetWeightKg: 110 }).success).toBe(false);
  });
  it('target BMI below 18.5 is rejected', () => {
    expect(
      goalsSchema(ctx).safeParse({ ...base, targetWeightKg: 60, secondaryTargetWeightKg: null })
        .success,
    ).toBe(false);
  });
  it('rate above 1% is rejected; above 0.75% needs confirmation', () => {
    expect(goalsSchema(ctx).safeParse({ ...base, weeklyRatePct: 1.2 }).success).toBe(false);
    expect(goalsSchema(ctx).safeParse({ ...base, weeklyRatePct: 0.9 }).success).toBe(false);
    expect(
      goalsSchema(ctx).safeParse({ ...base, weeklyRatePct: 0.9, rateWarningAccepted: true })
        .success,
    ).toBe(true);
  });
  it('secondary target must be below main target', () => {
    expect(goalsSchema(ctx).safeParse({ ...base, secondaryTargetWeightKg: 95 }).success).toBe(
      false,
    );
  });
  it('maintain needs no target', () => {
    expect(
      goalsSchema(ctx).safeParse({
        ...base,
        goalType: 'maintain',
        targetWeightKg: null,
        secondaryTargetWeightKg: null,
        weeklyRatePct: null,
      }).success,
    ).toBe(true);
  });
});

describe('equipment step', () => {
  it('"none" is exclusive', () => {
    const r = equipmentSchema.safeParse({
      environment: 'home',
      items: [
        { type: 'none', customName: null, maxWeightKg: null },
        { type: 'dumbbells', customName: null, maxWeightKg: 5 },
      ],
    });
    expect(r.success).toBe(false);
  });
  it('custom items need a name', () => {
    expect(
      equipmentSchema.safeParse({
        environment: 'home',
        items: [{ type: 'custom', customName: null, maxWeightKg: null }],
      }).success,
    ).toBe(false);
  });
});

describe('consent step', () => {
  const all = { terms: true, privacy: true, healthData: false, notifications: false };
  it('terms and privacy are required', () => {
    expect(
      consentSchema({ hasHealthData: false }).safeParse({ ...all, terms: false }).success,
    ).toBe(false);
    expect(consentSchema({ hasHealthData: false }).safeParse(all).success).toBe(true);
  });
  it('health data needs explicit consent', () => {
    expect(consentSchema({ hasHealthData: true }).safeParse(all).success).toBe(false);
    expect(
      consentSchema({ hasHealthData: true }).safeParse({ ...all, healthData: true }).success,
    ).toBe(true);
  });
});

describe('sign up', () => {
  it('requires letters, digits and 8+ characters', () => {
    const ok = { email: 'a@example.com', password: 'abcd1234', confirmPassword: 'abcd1234' };
    expect(signUpSchema.safeParse(ok).success).toBe(true);
    expect(
      signUpSchema.safeParse({ ...ok, password: 'abcdefgh', confirmPassword: 'abcdefgh' }).success,
    ).toBe(false);
    expect(
      signUpSchema.safeParse({ ...ok, password: 'abc123', confirmPassword: 'abc123' }).success,
    ).toBe(false);
    expect(signUpSchema.safeParse({ ...ok, confirmPassword: 'other1234' }).success).toBe(false);
    expect(signUpSchema.safeParse({ ...ok, email: 'not-an-email' }).success).toBe(false);
  });
});

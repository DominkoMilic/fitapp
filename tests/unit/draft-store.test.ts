import { useOnboardingDraft } from '@/features/onboarding/draft-store';

describe('onboarding draft store', () => {
  it('actions return undefined (safe to call from effects)', () => {
    // Regression: the persist middleware's setter returns a Promise; returning it from a
    // useEffect made React call it as a cleanup function and crash the onboarding flow.
    const s = useOnboardingDraft.getState();
    expect(s.setLastStep('goals')).toBeUndefined();
    expect(s.save('healthConsent', true)).toBeUndefined();
    expect(s.reset()).toBeUndefined();
    expect(s.bindUser('u1')).toBeUndefined();
  });

  it('a different user gets a fresh draft', () => {
    const s = useOnboardingDraft.getState();
    s.bindUser('user-a');
    s.save('healthConsent', true);
    s.setLastStep('schedule');
    useOnboardingDraft.getState().bindUser('user-b');
    const after = useOnboardingDraft.getState();
    expect(after.userId).toBe('user-b');
    expect(after.healthConsent).toBe(false);
    expect(after.lastStep).toBe('personal');
  });

  it('the same user keeps their draft', () => {
    const s = useOnboardingDraft.getState();
    s.bindUser('user-c');
    s.setLastStep('nutrition');
    useOnboardingDraft.getState().bindUser('user-c');
    expect(useOnboardingDraft.getState().lastStep).toBe('nutrition');
  });
});

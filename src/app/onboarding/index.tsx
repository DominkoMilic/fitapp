import { Redirect } from 'expo-router';

import { useOnboardingDraft } from '@/features/onboarding/draft-store';

/** Resumes onboarding at the last step the user reached (spec 28.2 #1). */
export default function OnboardingIndex() {
  const lastStep = useOnboardingDraft((s) => s.lastStep);
  return <Redirect href={`/onboarding/${lastStep}`} />;
}

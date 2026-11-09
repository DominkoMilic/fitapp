import { router } from 'expo-router';
import { useState } from 'react';

import { Button, Text, Toggle } from '@/components/ui';
import { consentSchema, type ConsentValues } from '@/domain/validation/onboarding';
import { OnboardingStep } from '@/features/onboarding/components/OnboardingStep';
import { useOnboardingDraft } from '@/features/onboarding/draft-store';

export default function ConsentStep() {
  const saved = useOnboardingDraft((s) => s.consent);
  const healthConsent = useOnboardingDraft((s) => s.healthConsent);
  const hasHealthData = (useOnboardingDraft((s) => s.health)?.injuries.length ?? 0) > 0;
  const save = useOnboardingDraft((s) => s.save);
  const [values, setValues] = useState<ConsentValues>(
    saved ?? { terms: false, privacy: false, healthData: healthConsent, notifications: false },
  );
  const [errors, setErrors] = useState<Partial<Record<keyof ConsentValues, string>>>({});

  const onContinue = () => {
    const merged = { ...values, healthData: hasHealthData ? healthConsent : values.healthData };
    const parsed = consentSchema({ hasHealthData }).safeParse(merged);
    if (!parsed.success) {
      const next: Partial<Record<keyof ConsentValues, string>> = {};
      for (const issue of parsed.error.issues)
        next[issue.path[0] as keyof ConsentValues] = issue.message;
      setErrors(next);
      return;
    }
    save('consent', parsed.data);
    router.replace('/onboarding/plan');
  };

  return (
    <OnboardingStep step="consent" title="Privacy and consent" onContinue={onContinue}>
      <Text color="textSecondary">
        Your data is private to your account, protected by row-level security, and never sold or
        shared. You can export or delete it at any time.
      </Text>
      <Button
        title="Read the privacy policy"
        variant="ghost"
        fullWidth={false}
        onPress={() => router.push('/legal/privacy')}
      />
      <Button
        title="Read the terms of use"
        variant="ghost"
        fullWidth={false}
        onPress={() => router.push('/legal/terms')}
      />
      <Button
        title="Read the health disclaimer"
        variant="ghost"
        fullWidth={false}
        onPress={() => router.push('/legal/disclaimer')}
      />
      <Button
        title="Data sources and licences"
        variant="ghost"
        fullWidth={false}
        onPress={() => router.push('/legal/licences')}
      />
      <Toggle
        label="I accept the terms of use"
        value={values.terms}
        onChange={(terms) => setValues({ ...values, terms })}
        error={errors.terms}
      />
      <Toggle
        label="I accept the privacy policy"
        value={values.privacy}
        onChange={(privacy) => setValues({ ...values, privacy })}
        error={errors.privacy}
      />
      {hasHealthData ? (
        <Text variant="small" color="textSecondary">
          Health data:{' '}
          {healthConsent ? 'you agreed to store your injury details.' : 'consent missing.'}
        </Text>
      ) : null}
      {errors.healthData ? (
        <Text variant="small" color="danger">
          {errors.healthData}
        </Text>
      ) : null}
      <Toggle
        label="Reminders (optional)"
        description="Workout and game reminders. You choose which ones later."
        value={values.notifications}
        onChange={(notifications) => setValues({ ...values, notifications })}
      />
      <Text variant="caption" color="textSecondary">
        Location permission is only requested when you first track a walk, run or ride.
      </Text>
    </OnboardingStep>
  );
}

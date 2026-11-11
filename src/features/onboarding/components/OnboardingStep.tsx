import { router } from 'expo-router';
import { type PropsWithChildren, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Screen, Text } from '@/components/ui';
import { radius, useTheme } from '@/theme';

import { useOnboardingDraft } from '../draft-store';
import { ONBOARDING_STEPS, type OnboardingStepId, previousStep, stepIndex } from '../steps';

export function OnboardingStep({
  step,
  title,
  subtitle,
  onContinue,
  continueLabel = 'Continue',
  loading,
  onSkip,
  children,
}: PropsWithChildren<{
  step: OnboardingStepId;
  title: string;
  subtitle?: string;
  onContinue: () => void;
  continueLabel?: string;
  loading?: boolean;
  onSkip?: () => void;
}>) {
  const { colors } = useTheme();
  const setLastStep = useOnboardingDraft((s) => s.setLastStep);
  const index = stepIndex(step);
  const prev = previousStep(step);

  useEffect(() => {
    // Braces matter: the persisted store's setter returns a Promise, which must not
    // be returned from the effect (React would call it as a cleanup function).
    setLastStep(step);
  }, [setLastStep, step]);

  return (
    <Screen
      locked={!!loading}
      footer={
        <>
          <Button title={continueLabel} loading={loading} onPress={onContinue} />
          <View style={styles.row}>
            {prev ? (
              <Button
                title="Back"
                variant="ghost"
                fullWidth={false}
                onPress={() => router.replace(`/onboarding/${prev}`)}
              />
            ) : (
              <View />
            )}
            {onSkip ? (
              <Button title="Skip for now" variant="ghost" fullWidth={false} onPress={onSkip} />
            ) : null}
          </View>
        </>
      }
    >
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={`Step ${index + 1} of ${ONBOARDING_STEPS.length}`}
        accessibilityValue={{ min: 1, max: ONBOARDING_STEPS.length, now: index + 1 }}
        style={styles.progressRow}
      >
        {ONBOARDING_STEPS.map((s, i) => (
          <View
            key={s.id}
            style={[
              styles.segment,
              { backgroundColor: i <= index ? colors.accent : colors.surfaceRaised },
            ]}
          />
        ))}
      </View>
      <Text variant="caption" color="textSecondary">
        Step {index + 1} of {ONBOARDING_STEPS.length}
      </Text>
      <Text variant="heading" accessibilityRole="header">
        {title}
      </Text>
      {subtitle ? (
        <Text variant="body" color="textSecondary">
          {subtitle}
        </Text>
      ) : null}
      {children}
    </Screen>
  );
}

const styles = StyleSheet.create({
  progressRow: { flexDirection: 'row', gap: 4 },
  segment: { flex: 1, height: 4, borderRadius: radius.pill },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
});

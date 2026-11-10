import { Check } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Text } from '@/components/ui/Text';
import { PASSWORD_RULES, passwordChecks } from '@/domain/validation/auth';
import { haptics, motion, spacing, useTheme } from '@/theme';

function Rule({ label, met, failed }: { label: string; met: boolean; failed: boolean }) {
  const { colors, reduceMotion } = useTheme();
  const scale = useSharedValue(1);
  // The strike-through is drawn as a line that grows across the label (Android drops text
  // decoration on some re-renders, and this way it animates).
  const strike = useSharedValue(met ? 1 : 0);
  const wasMet = useRef(met);

  useEffect(() => {
    strike.set(reduceMotion ? (met ? 1 : 0) : withTiming(met ? 1 : 0, { duration: motion.normal }));
    if (met && !wasMet.current) {
      haptics.selection();
      if (!reduceMotion)
        scale.set(withSequence(withTiming(1.25, { duration: motion.fast }), withSpring(1)));
    }
    wasMet.current = met;
  }, [met, reduceMotion, scale, strike]);

  const pop = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  const line = useAnimatedStyle(() => ({ transform: [{ scaleX: strike.get() }] }));
  const color = met ? colors.accent : failed ? colors.danger : colors.textSecondary;

  return (
    <View
      style={styles.rule}
      accessible
      accessibilityLabel={`${label}: ${met ? 'done' : 'not yet'}`}
    >
      <Animated.View
        testID={met ? 'rule-met' : 'rule-open'}
        style={[
          styles.circle,
          { borderColor: color, backgroundColor: met ? colors.accent : 'transparent' },
          pop,
        ]}
      >
        {met ? <Check size={12} color={colors.onAccent} strokeWidth={3} /> : null}
      </Animated.View>
      <View>
        <Text variant="small" style={{ color }}>
          {label}
        </Text>
        <Animated.View
          pointerEvents="none"
          testID={met ? 'strike-on' : 'strike-off'}
          style={[styles.strike, { backgroundColor: color }, line]}
        />
      </View>
    </View>
  );
}

/**
 * Live password rules under a new-password field: each rule ticks off (with a little pop) as it's
 * met. Unmet rules stay grey while typing and turn red once the user tried to submit (`showErrors`).
 */
export function PasswordChecklist({
  password,
  showErrors = false,
}: {
  password: string;
  showErrors?: boolean;
}) {
  const checks = passwordChecks(password);
  return (
    <View style={styles.list} accessibilityLabel="Password requirements">
      {PASSWORD_RULES.map((r) => (
        <Rule key={r.key} label={r.label} met={checks[r.key]} failed={showErrors} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.xxs, marginTop: -spacing.xs },
  rule: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: 24 },
  strike: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '52%',
    height: 1.5,
    transformOrigin: 'left',
  },
  circle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

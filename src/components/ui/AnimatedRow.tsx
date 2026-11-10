import type { PropsWithChildren } from 'react';
import Animated, { FadeIn, FadeOutLeft, LinearTransition } from 'react-native-reanimated';

import { motion, useTheme } from '@/theme';

/**
 * A list row that fades in when added, slides out to the left when removed and slides when the rows around it
 * move (spec 23.4). Plain view when "reduce motion" is on.
 */
export function AnimatedRow({ children }: PropsWithChildren) {
  const { reduceMotion } = useTheme();
  if (reduceMotion) return <Animated.View>{children}</Animated.View>;
  return (
    <Animated.View
      entering={FadeIn.duration(motion.normal)}
      exiting={FadeOutLeft.duration(motion.normal)}
      layout={LinearTransition.duration(motion.normal)}
    >
      {children}
    </Animated.View>
  );
}

/**
 * Keys that stay with a row when rows are reordered or removed: the name plus how many rows
 * before it share that name ("salt", "salt#2").
 */
export function rowKeys<T>(rows: readonly T[], nameOf: (row: T) => string): string[] {
  const seen = new Map<string, number>();
  return rows.map((r) => {
    const n = nameOf(r);
    const c = (seen.get(n) ?? 0) + 1;
    seen.set(n, c);
    return c === 1 ? n : `${n}#${c}`;
  });
}

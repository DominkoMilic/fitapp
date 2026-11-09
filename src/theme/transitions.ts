import { motion } from './tokens';

export type StackKind = 'stack' | 'modal' | 'onboarding';

/**
 * Native stack animation options (spec 23.4). One slide for pushes everywhere, slide-up for
 * modals, a cross-fade between onboarding steps; a plain quick fade when "reduce motion" is on.
 */
export function stackAnimation(reduceMotion: boolean, kind: StackKind = 'stack') {
  if (reduceMotion) return { animation: 'fade' as const, animationDuration: motion.fast };
  return {
    animation: motion.transitions[kind],
    animationDuration: kind === 'onboarding' ? motion.normal : motion.screen,
  };
}

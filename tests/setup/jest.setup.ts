/* Global Jest setup: mock native modules that have no JS implementation in tests. */
jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('@react-native-community/netinfo', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-community/netinfo/jest/netinfo-mock.js'),
);

jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(() => Promise.resolve()),
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light' },
  NotificationFeedbackType: { Success: 'success' },
}));

// Reanimated in tests: layout animations render as plain views and animations jump to their end
// value. Covers AnimatedRow, Toast and SwipeToDismiss (src/components/ui).
jest.mock('react-native-reanimated', () => {
  const { View } = jest.requireActual('react-native');
  const preset = { duration: () => preset };
  return {
    __esModule: true,
    default: { View, createAnimatedComponent: (c: unknown) => c },
    View,
    createAnimatedComponent: (c: unknown) => c,
    useSharedValue: (initial: unknown) => {
      let v = initial;
      return {
        get: () => v,
        set: (n: unknown) => {
          v = n;
        },
      };
    },
    useAnimatedStyle: () => ({}),
    withTiming: (to: unknown) => to,
    withSpring: (to: unknown) => to,
    withSequence: (...steps: unknown[]) => steps[steps.length - 1],
    interpolateColor: (v: number, _in: number[], out: string[]) => (v >= 1 ? out[1] : out[0]),
    FadeIn: preset,
    FadeOut: preset,
    FadeInDown: preset,
    FadeOutDown: preset,
    FadeOutLeft: preset,
    LinearTransition: preset,
    SlideInDown: preset,
    SlideOutDown: preset,
    ZoomIn: preset,
    SlideInLeft: preset,
    SlideInRight: preset,
    isSharedValue: () => false,
  };
});

jest.mock('react-native-worklets', () => ({
  scheduleOnRN: (fn: (...a: unknown[]) => void, ...args: unknown[]) => fn(...args),
}));

jest.mock('react-native-keyboard-controller', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('react-native-keyboard-controller/jest'),
);

// eslint-disable-next-line @typescript-eslint/no-require-imports
require('react-native-gesture-handler/jestSetup');

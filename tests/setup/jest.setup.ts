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

// Reanimated in tests: layout animations render as plain views. The app only uses Animated.View
// with FadeIn / FadeOut / LinearTransition (src/components/ui/AnimatedRow.tsx).
jest.mock('react-native-reanimated', () => {
  const { View } = jest.requireActual('react-native');
  const preset = { duration: () => preset };
  return {
    __esModule: true,
    default: { View },
    View,
    FadeIn: preset,
    FadeOut: preset,
    LinearTransition: preset,
  };
});

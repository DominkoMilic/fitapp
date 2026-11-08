import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * PACE app configuration.
 *
 * Environment variables (see .env.example):
 * - EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY are inlined into the app bundle.
 *   They are safe to ship: data is protected by Row Level Security.
 * - Never put service-role keys or third-party API secrets in EXPO_PUBLIC_* variables.
 *
 * Missing required variables do not crash config evaluation (so `expo lint`, tests and EAS
 * can run); the app shows a configuration error screen at runtime instead (src/config/env.ts).
 */
const APP_ENV = process.env.EXPO_PUBLIC_APP_ENV ?? 'development';
const IS_PROD = APP_ENV === 'production';

const BUNDLE_ID = IS_PROD ? 'app.pace.fitness' : `app.pace.fitness.${APP_ENV}`;

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: IS_PROD ? 'PACE' : `PACE (${APP_ENV})`,
  slug: 'pace',
  scheme: 'pace',
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  ios: {
    supportsTablet: false,
    bundleIdentifier: BUNDLE_ID,
  },
  android: {
    package: BUNDLE_ID,
    adaptiveIcon: {
      backgroundColor: '#121417',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    favicon: './assets/favicon.png',
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    'expo-localization',
    'expo-sqlite',
    '@react-native-community/datetimepicker',
    [
      'expo-splash-screen',
      {
        image: './assets/splash-icon.png',
        imageWidth: 160,
        resizeMode: 'contain',
        backgroundColor: '#F7F8FA',
        dark: { backgroundColor: '#121417' },
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    appEnv: APP_ENV,
  },
});

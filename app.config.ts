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
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  ios: {
    supportsTablet: false,
    bundleIdentifier: BUNDLE_ID,
    // Only standard HTTPS: no export-compliance documentation needed.
    config: { usesNonExemptEncryption: false },
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
    // Added by libraries but not used by PACE (no overlays; files are shared from the app cache).
    blockedPermissions: [
      'android.permission.SYSTEM_ALERT_WINDOW',
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
    ],
  },
  web: {
    favicon: './assets/favicon.png',
  },
  plugins: [
    // Listed first so its Info.plist change runs after expo-task-manager's (mods run in reverse).
    './plugins/withLocationOnlyBackground',
    'expo-router',
    // No biometric unlock in V1, so no Face ID usage string.
    ['expo-secure-store', { faceIDPermission: false }],
    'expo-localization',
    ['expo-notifications', { color: '#34D399' }],
    'expo-sqlite',
    [
      'expo-location',
      {
        // Shown by iOS before the system prompt. Background access is used only while recording.
        locationWhenInUsePermission:
          'PACE uses your location to measure the distance and route of walks, runs and rides you record.',
        locationAlwaysAndWhenInUsePermission:
          'PACE uses your location in the background only while you are recording a walk, run or ride, so tracking continues when your screen is locked.',
        isIosBackgroundLocationEnabled: true,
        isAndroidBackgroundLocationEnabled: true,
        isAndroidForegroundServiceEnabled: true,
        // Activity type is chosen by the user; motion sensors aren't used.
        motionUsagePermission: false,
      },
    ],
    'expo-task-manager',
    [
      'react-native-maps',
      // Android map tiles need a Google Maps key (restricted to this app). Without one, PACE draws
      // the route without map tiles. iOS uses Apple Maps and needs no key.
      process.env.GOOGLE_MAPS_ANDROID_API_KEY
        ? { androidGoogleMapsApiKey: process.env.GOOGLE_MAPS_ANDROID_API_KEY }
        : {},
    ],
    '@react-native-community/datetimepicker',
    [
      'expo-build-properties',
      {
        android: {
          // Release builds are shrunk with R8. WorkManager (used by notifications and background
          // tasks) creates its Room database by reflection, so R8 must keep those classes or the
          // app crashes on launch ("Failed to create an instance of WorkDatabase").
          extraProguardRules: [
            '-keep class * extends androidx.room.RoomDatabase { <init>(); }',
            '-keep class androidx.work.impl.WorkDatabase_Impl { *; }',
          ].join('\n'),
        },
      },
    ],
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
    hasAndroidMapsKey: !!process.env.GOOGLE_MAPS_ANDROID_API_KEY,
  },
});

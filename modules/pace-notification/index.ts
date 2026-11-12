import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';

interface PaceNotificationModule {
  update(
    tag: string,
    title: string | null,
    body: string | null,
    chronometerBase: number | null,
  ): boolean;
}

/** Android only; null on iOS, web, Expo Go and in tests (callers fall back to plain text). */
export const PaceNotification: PaceNotificationModule | null =
  Platform.OS === 'android'
    ? requireOptionalNativeModule<PaceNotificationModule>('PaceNotification')
    : null;

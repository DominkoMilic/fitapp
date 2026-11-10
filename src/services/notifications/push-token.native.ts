import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/**
 * The device's Expo push token, or null without notification permission. Never asks for
 * permission itself: reminders already ask when they are switched on (spec 17).
 */
export async function devicePushToken(
  projectId: string,
): Promise<{ token: string; platform: 'ios' | 'android' } | null> {
  const perm = await Notifications.getPermissionsAsync();
  if (!perm.granted) return null;
  const res = await Notifications.getExpoPushTokenAsync({ projectId });
  return { token: res.data, platform: Platform.OS === 'ios' ? 'ios' : 'android' };
}

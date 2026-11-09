import { Linking } from 'react-native';

/** Only plain https:// links leave the app (no javascript:, data:, file:, intent: or custom schemes). */
export function isSafeExternalUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && !!u.hostname;
  } catch {
    return false;
  }
}

export async function openExternalUrl(url: string | null | undefined): Promise<boolean> {
  if (!isSafeExternalUrl(url)) return false;
  await Linking.openURL(url);
  return true;
}

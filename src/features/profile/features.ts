import { usePreferences } from './api';

/**
 * Optional parts of PACE the user can switch on (Settings → App features). Social is off by
 * default, and counts as off while preferences load, so nothing flickers in.
 */
export function useFeatures() {
  const prefs = usePreferences();
  return {
    social: prefs.data?.social_enabled ?? false,
    loaded: prefs.isSuccess,
  };
}

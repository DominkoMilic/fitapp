import { type Href, router } from 'expo-router';

/**
 * Back when there is history; otherwise (opened from a link, a notification, or a page reload)
 * to the given parent screen instead of failing.
 */
export function goBack(fallback: Href = '/home') {
  if (router.canGoBack()) router.back();
  else router.replace(fallback);
}

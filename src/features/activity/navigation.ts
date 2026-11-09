import { router } from 'expo-router';

/** Back when there is history (e.g. not after a deep link or reload), else to the activity list. */
export const backToActivities = () =>
  router.canGoBack() ? router.back() : router.replace('/activity');

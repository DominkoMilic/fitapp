import { goBack } from '@/navigation/back';

/** Back when there is history (e.g. not after a deep link or reload), else to the activity list. */
export const backToActivities = () => goBack('/activity');

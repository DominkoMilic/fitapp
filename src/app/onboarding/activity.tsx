import { Redirect } from 'expo-router';

/** Activity level is now part of "About you"; kept so saved drafts and old links still resolve. */
export default function ActivityStep() {
  return <Redirect href="/onboarding/personal" />;
}

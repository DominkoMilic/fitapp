import { Redirect } from 'expo-router';

/** Equipment is now part of "Your week"; kept so saved drafts and old links still resolve. */
export default function EquipmentStep() {
  return <Redirect href="/onboarding/schedule" />;
}

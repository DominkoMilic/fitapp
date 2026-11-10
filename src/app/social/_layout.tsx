import { SignedInStack } from '@/features/progress/StackLayout';

export default function SocialLayout() {
  return (
    <SignedInStack
      titles={{ setup: 'Set up social', search: 'Add friends', 'user/[handle]': 'Profile' }}
    />
  );
}

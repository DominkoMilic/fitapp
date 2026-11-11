import { SignedInStack } from '@/features/progress/StackLayout';

export default function SocialLayout() {
  return (
    <SignedInStack
      fallback="/social"
      titles={{
        setup: 'Set up social',
        search: 'Add friends',
        'user/[handle]': 'Profile',
        'item/[id]': 'Post',
      }}
    />
  );
}

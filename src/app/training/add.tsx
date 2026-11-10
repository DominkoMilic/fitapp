import { router } from 'expo-router';

import { ListItem, Screen, SectionHeader } from '@/components/ui';

/**
 * One place for every way to add training, so the Training tab has a single "Add" button.
 * Starting today's planned workout stays on the Today card.
 */
export default function AddTraining() {
  // Replace this screen so Back from the next one returns to the Training tab.
  const go = (pathname: Parameters<typeof router.replace>[0]) => router.replace(pathname);
  return (
    <Screen edges={['bottom']}>
      <SectionHeader title="Now" />
      <ListItem
        title="Record a walk, run or ride"
        subtitle="Tracks distance and pace with GPS"
        onPress={() => go('/activity/track')}
      />

      <SectionHeader title="Already done" />
      <ListItem
        title="Gym or home workout"
        subtitle="Add the exercises, sets and time"
        onPress={() => go('/training/log-workout')}
      />
      <ListItem
        title="Game, practice or other sport"
        subtitle="Duration and how hard it felt"
        onPress={() => go('/training/log-event')}
      />
      <ListItem
        title="Walk, run or ride"
        subtitle="Without GPS: distance and time"
        onPress={() => go('/activity/manual')}
      />

      <SectionHeader title="Later" />
      <ListItem
        title="Plan a workout"
        subtitle="Add a workout to your calendar"
        onPress={() => go('/training/add-workout')}
      />
    </Screen>
  );
}

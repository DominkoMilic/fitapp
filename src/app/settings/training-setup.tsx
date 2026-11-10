import { router } from 'expo-router';

import { ListItem, Screen, Text } from '@/components/ui';
import { SPORT_BY_KEY } from '@/domain/sports/catalogue';
import { plural } from '@/domain/format';
import { useEquipment, usePreferences } from '@/features/profile/api';

/** Sports, schedule and equipment behind one Profile row; each keeps its own form and Save. */
export default function TrainingSetup() {
  const prefs = usePreferences().data;
  const equipment = useEquipment().data;

  const sports = prefs?.sports ?? [];
  const sportsValue = !prefs
    ? undefined
    : sports.length === 0
      ? 'None'
      : sports.length === 1
        ? (SPORT_BY_KEY[sports[0] as string]?.label ?? '1 sport')
        : plural(sports.length, 'sport');
  const scheduleValue = prefs
    ? `${prefs.training_days_per_week ?? 0}×/week · ${prefs.max_session_minutes ?? 45} min`
    : undefined;
  const owned = (equipment ?? []).filter((e) => e.equipment_type !== 'none');
  const equipmentValue = !equipment
    ? undefined
    : owned.length === 0
      ? 'None'
      : plural(owned.length, 'item');

  return (
    <Screen edges={['bottom']}>
      <Text color="textSecondary">
        Your weekly plan is built from these. Changing any of them updates it.
      </Text>
      <ListItem
        title="Sports"
        subtitle="Games, practices and fixed activities"
        value={sportsValue}
        onPress={() => router.push('/settings/sports')}
      />
      <ListItem
        title="Schedule"
        subtitle="Sessions per week, days and length"
        value={scheduleValue}
        onPress={() => router.push('/settings/training')}
      />
      <ListItem
        title="Equipment"
        subtitle="What you can train with"
        value={equipmentValue}
        onPress={() => router.push('/settings/equipment')}
      />
    </Screen>
  );
}

import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Banner, useToast } from '@/components/feedback';
import { Button, Screen, Text } from '@/components/ui';
import { TEMPLATES } from '@/domain/training/catalogue';
import { useToday } from '@/features/dashboard/useToday';
import { DateField } from '@/features/onboarding/components/DateField';
import { OptionCard } from '@/features/onboarding/components/OptionCard';
import { useRestrictions } from '@/features/training/library';
import { useScheduleActions } from '@/features/training/schedule-api';
import { spacing } from '@/theme';
import { useSubmit } from '@/hooks/useSubmit';

export default function AddWorkout() {
  const { today } = useToday();
  const actions = useScheduleActions();
  const restrictions = useRestrictions();
  const showToast = useToast((s) => s.show);
  const [slug, setSlug] = useState<string | null>(null);
  const [date, setDate] = useState<string | null>(today);
  const [error, setError] = useState<string | null>(null);
  const available = TEMPLATES.filter(
    (t) => !(t.slug === 'futsal-skills' && restrictions.sportRestricted),
  );

  const save = async () => {
    if (!slug) return setError('Choose a workout');
    if (!date) return setError('Choose a date');
    const id = await actions.addOneOff({ date, templateSlug: slug, time: null });
    showToast('Workout added');
    router.replace({ pathname: '/training/workout/[id]', params: { id } });
  };
  const submit = useSubmit(save);

  return (
    <Screen
      edges={['bottom']}
      footer={
        <Button title="Add to calendar" loading={submit.busy} onPress={() => void submit.run()} />
      }
    >
      {error ? <Banner tone="danger" message={error} /> : null}
      <DateField label="Date" value={date} onChange={setDate} />
      <Text variant="small" color="textSecondary">
        Workout
      </Text>
      <View style={{ gap: spacing.xs }} accessibilityRole="radiogroup">
        {available.map((t) => (
          <OptionCard
            key={t.slug}
            title={`${t.name} · ${t.minutes} min`}
            description={t.description}
            selected={slug === t.slug}
            onPress={() => setSlug(t.slug)}
          />
        ))}
      </View>
    </Screen>
  );
}

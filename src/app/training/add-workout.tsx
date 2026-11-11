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
import { SPORT_BY_KEY } from '@/domain/sports/catalogue';
import { useFieldErrors } from '@/hooks/useFieldErrors';
import { FieldError } from '@/components/ui/FieldError';

export default function AddWorkout() {
  const { today } = useToday();
  const actions = useScheduleActions();
  const restrictions = useRestrictions();
  const showToast = useToast((s) => s.show);
  const [slug, setSlug] = useState<string | null>(null);
  const [date, setDate] = useState<string | null>(today);
  const [error, setError] = useState<string | null>(null);
  const fields = useFieldErrors<'date' | 'slug'>();
  // Sport drill packs only for sports the user plays and isn't injured for.
  const available = TEMPLATES.filter((t) => {
    if (t.category !== 'football' && t.category !== 'sport_skills') return true;
    const sports = restrictions.sports.filter((k) => SPORT_BY_KEY[k]?.drillPack === t.slug);
    return sports.length > 0 && sports.some((k) => !restrictions.restrictedFor(k));
  });

  const save = async () => {
    setError(null);
    const ok = fields.show({
      ...(!date ? { date: 'Choose a date' } : {}),
      ...(!slug ? { slug: 'Choose a workout' } : {}),
    });
    if (!ok || !slug || !date) return;
    const id = await actions.addOneOff({ date, templateSlug: slug, time: null });
    showToast('Workout added');
    router.replace({ pathname: '/training/workout/[id]', params: { id } });
  };
  const submit = useSubmit(save);

  return (
    <Screen
      locked={submit.busy}
      edges={['bottom']}
      footer={
        <Button title="Add to calendar" loading={submit.busy} onPress={() => void submit.run()} />
      }
    >
      {error ? <Banner tone="danger" message={error} /> : null}
      <DateField
        min={today}
        label="Date"
        value={date}
        onChange={(v) => {
          setDate(v);
          fields.clear('date');
        }}
        error={fields.errors.date}
      />
      <Text variant="small" color={fields.errors.slug ? 'danger' : 'textSecondary'}>
        Workout
      </Text>
      <FieldError message={fields.errors.slug} />
      <View style={{ gap: spacing.xs }} accessibilityRole="radiogroup">
        {available.map((t) => (
          <OptionCard
            key={t.slug}
            title={`${t.name} · ${t.minutes} min`}
            description={t.description}
            selected={slug === t.slug}
            onPress={() => {
              setSlug(t.slug);
              fields.clear('slug');
            }}
          />
        ))}
      </View>
    </Screen>
  );
}

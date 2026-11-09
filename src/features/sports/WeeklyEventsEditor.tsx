import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Banner, useToast } from '@/components/feedback';
import {
  AnimatedRow,
  Button,
  Card,
  ChipGroup,
  ListItem,
  NumberField,
  SectionHeader,
  Text,
  TextField,
} from '@/components/ui';
import { categoryLabel, intensityLabel } from '@/domain/format';
import { sportCategory } from '@/domain/sports/catalogue';
import { commitmentSchema } from '@/domain/validation/onboarding';
import { WEEKDAYS } from '@/features/onboarding/constants';
import { useProfile, useRecurringEvents } from '@/features/profile/api';
import { useSeriesActions } from '@/features/training/schedule-api';
import { spacing } from '@/theme';

import { CommitmentTypePicker } from './CommitmentTypePicker';

type Draft = {
  title: string;
  category: string;
  weekday: number;
  localTime: string;
  durationMinutes: number;
  intensity: 'easy' | 'moderate' | 'hard';
};

const blank = (sports: readonly string[]): Draft => ({
  title: '',
  category: sports[0] ? sportCategory(sports[0], 'match') : 'run',
  weekday: 6,
  localTime: '18:00',
  durationMinutes: 60,
  intensity: sports[0] ? 'hard' : 'moderate',
});

/** Weekly games, practices and fixed activities: list (tap to edit) and add new ones. */
export function WeeklyEventsEditor({ sports }: { sports: readonly string[] }) {
  const events = useRecurringEvents();
  const { data: profile } = useProfile();
  const { create } = useSeriesActions();
  const showToast = useToast((s) => s.show);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);

  const add = () => {
    if (!draft) return;
    const parsed = commitmentSchema.safeParse({
      ...draft,
      title: draft.title || categoryLabel(draft.category),
    });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? 'Check the details');
    setError(null);
    create.mutate(
      { ...parsed.data, intensity: draft.intensity, timezone: profile?.timezone ?? 'UTC' },
      {
        onSuccess: () => {
          setDraft(null);
          showToast('Added. Your week was updated around it.');
        },
        onError: () => setError("Couldn't save. Check your connection."),
      },
    );
  };

  return (
    <View style={styles.stack}>
      <SectionHeader title="Weekly games and fixed activities" />
      {(events.data ?? []).length === 0 && !draft ? (
        <Text color="textSecondary">Nothing fixed in your week yet.</Text>
      ) : null}
      {(events.data ?? []).map((e) => (
        <AnimatedRow key={e.id}>
          <ListItem
            title={e.title}
            subtitle={`${categoryLabel(e.category)} · ${WEEKDAYS[e.weekday - 1]?.label ?? ''} ${e.local_time.slice(0, 5)} · ${e.duration_minutes} min · ${intensityLabel(e.intensity)}`}
            onPress={() => router.push({ pathname: '/training/series/[id]', params: { id: e.id } })}
          />
        </AnimatedRow>
      ))}
      {draft ? (
        <Card raised>
          {error ? <Banner tone="danger" message={error} /> : null}
          <TextField
            label="Name (optional)"
            value={draft.title}
            onChangeText={(title) => setDraft({ ...draft, title })}
            maxLength={80}
          />
          <CommitmentTypePicker
            sports={sports}
            value={draft.category}
            onChange={(category, intensity) => setDraft({ ...draft, category, intensity })}
          />
          <ChipGroup
            accessibilityLabel="Day of the week"
            single
            options={WEEKDAYS}
            selected={[String(draft.weekday) as (typeof WEEKDAYS)[number]['value']]}
            onToggle={(v) => setDraft({ ...draft, weekday: Number(v) })}
          />
          <View style={styles.row}>
            <View style={styles.flex}>
              <TextField
                label="Start time (HH:MM)"
                value={draft.localTime}
                onChangeText={(localTime) => setDraft({ ...draft, localTime })}
                keyboardType="numbers-and-punctuation"
                maxLength={5}
              />
            </View>
            <View style={styles.flex}>
              <NumberField
                label="Duration"
                suffix="min"
                decimal={false}
                precision={0}
                value={draft.durationMinutes}
                onChangeValue={(v) => setDraft({ ...draft, durationMinutes: v ?? 0 })}
              />
            </View>
          </View>
          <Button title="Add to my week" loading={create.isPending} onPress={add} />
          <Button title="Cancel" variant="ghost" onPress={() => setDraft(null)} />
        </Card>
      ) : (
        <Button
          title={sports.length ? 'Add a game, practice or activity' : 'Add a fixed activity'}
          variant="secondary"
          onPress={() => setDraft(blank(sports))}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.xs },
  flex: { flex: 1 },
});

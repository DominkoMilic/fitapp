import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { goBack } from '@/navigation/back';
import { Banner, ConfirmDialog, ErrorState, LoadingState } from '@/components/feedback';
import { Button, ChipGroup, NumberField, Screen, Text, TextField } from '@/components/ui';
import { WEEKDAYS } from '@/features/onboarding/constants';
import { type RecurringEvent, useRecurringEvents } from '@/features/profile/api';
import { useSeriesActions } from '@/features/training/schedule-api';
import { useFieldErrors } from '@/hooks/useFieldErrors';

export default function SeriesEdit() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const events = useRecurringEvents();
  if (events.isPending)
    return (
      <Screen edges={['bottom']}>
        <LoadingState />
      </Screen>
    );
  const e = events.data?.find((x) => x.id === id);
  if (!e)
    return (
      <Screen edges={['bottom']}>
        <ErrorState title="Not found" message="This recurring session no longer exists." />
      </Screen>
    );
  return <SeriesForm e={e} />;
}

function SeriesForm({ e }: { e: RecurringEvent }) {
  const { update, end } = useSeriesActions();
  const [title, setTitle] = useState(e.title);
  const [weekday, setWeekday] = useState(e.weekday);
  const [time, setTime] = useState(e.local_time.slice(0, 5));
  const [duration, setDuration] = useState<number | null>(e.duration_minutes);
  const [error, setError] = useState<string | null>(null);
  const fields = useFieldErrors<'title' | 'time' | 'duration'>();
  const [confirmEnd, setConfirmEnd] = useState(false);

  const save = () => {
    setError(null);
    const ok = fields.show({
      ...(!title.trim() ? { title: 'Enter a name' } : {}),
      ...(!/^([01]\d|2[0-3]):[0-5]\d$/.test(time) ? { time: 'Use HH:MM, e.g. 18:30' } : {}),
      ...(!duration || duration < 5 || duration > 300
        ? { duration: 'Duration must be 5–300 minutes' }
        : {}),
    });
    if (!ok || !duration) return;
    update.mutate(
      { eventId: e.id, weekday, localTime: time, durationMinutes: duration, title: title.trim() },
      { onSuccess: () => goBack('/training') },
    );
  };

  return (
    <Screen
      edges={['bottom']}
      footer={
        <Button title="Save for all future sessions" loading={update.isPending} onPress={save} />
      }
    >
      {error ? <Banner tone="danger" message={error} /> : null}
      {update.isError || end.isError ? (
        <Banner
          tone="danger"
          message="Couldn't save. This change needs a connection; please try again."
        />
      ) : null}
      <Text color="textSecondary">
        Changes apply to future sessions. Past and completed ones stay as they were.
      </Text>
      <TextField
        label="Name"
        value={title}
        onChangeText={(t) => {
          setTitle(t);
          fields.clear('title');
        }}
        maxLength={80}
        error={fields.errors.title}
      />
      <ChipGroup
        accessibilityLabel="Day of the week"
        options={WEEKDAYS}
        selected={[String(weekday) as (typeof WEEKDAYS)[number]['value']]}
        onToggle={(v) => setWeekday(Number(v))}
      />
      <TextField
        label="Start time (HH:MM)"
        value={time}
        onChangeText={(t) => {
          setTime(t);
          fields.clear('time');
        }}
        error={fields.errors.time}
        maxLength={5}
        keyboardType="numbers-and-punctuation"
      />
      <NumberField
        label="Duration"
        suffix="min"
        decimal={false}
        precision={0}
        value={duration}
        onChangeValue={(v) => {
          setDuration(v);
          fields.clear('duration');
        }}
        error={fields.errors.duration}
      />
      <Button
        title="End this recurring session"
        variant="ghost"
        onPress={() => setConfirmEnd(true)}
      />
      <ConfirmDialog
        visible={confirmEnd}
        destructive
        title="End this recurring session?"
        message="Future occurrences are removed. Past ones stay in your history."
        confirmLabel="End series"
        loading={end.isPending}
        onCancel={() => setConfirmEnd(false)}
        onConfirm={() =>
          end.mutate(e.id, {
            onSuccess: () => goBack('/training'),
            onSettled: () => setConfirmEnd(false),
          })
        }
      />
    </Screen>
  );
}

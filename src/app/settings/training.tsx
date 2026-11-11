import { useState } from 'react';

import { ErrorState, LoadingState } from '@/components/feedback';
import { Button, ChipGroup, Screen, SegmentedControl, Text } from '@/components/ui';
import { WEEKDAYS } from '@/features/onboarding/constants';
import { type Preferences, usePreferences, useUpdatePreferences } from '@/features/profile/api';
import { SaveState } from '@/features/profile/SaveState';

export default function TrainingSettings() {
  const prefs = usePreferences();
  if (prefs.isPending)
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  if (prefs.isError)
    return (
      <Screen>
        <ErrorState
          message="We couldn't load your preferences."
          onRetry={() => void prefs.refetch()}
        />
      </Screen>
    );
  return <TrainingForm prefs={prefs.data} />;
}

function TrainingForm({ prefs }: { prefs: Preferences | null }) {
  const update = useUpdatePreferences();
  const [days, setDays] = useState(prefs?.training_days_per_week ?? 3);
  const [preferred, setPreferred] = useState<number[]>(prefs?.preferred_training_days ?? []);
  const [minutes, setMinutes] = useState(prefs?.max_session_minutes ?? 45);

  return (
    <Screen
      locked={update.isPending}
      edges={['bottom']}
      footer={
        <Button
          title="Save and update my plan"
          loading={update.isPending}
          onPress={() =>
            update.mutate({
              training_days_per_week: days,
              preferred_training_days: preferred,
              max_session_minutes: minutes,
            })
          }
        />
      }
    >
      <SaveState status={update.status} error={update.error} />
      <Text variant="small" color="textSecondary">
        Training sessions per week (besides sport)
      </Text>
      <SegmentedControl
        accessibilityLabel="Training sessions per week"
        options={['0', '1', '2', '3', '4', '5'].map((v) => ({ value: v, label: v }))}
        value={String(days)}
        onChange={(v) => setDays(Number(v))}
      />
      <Text variant="small" color="textSecondary">
        Preferred days
      </Text>
      <ChipGroup
        accessibilityLabel="Preferred training days"
        options={WEEKDAYS}
        selected={preferred.map(String) as (typeof WEEKDAYS)[number]['value'][]}
        onToggle={(v) => {
          const n = Number(v);
          setPreferred(
            preferred.includes(n) ? preferred.filter((d) => d !== n) : [...preferred, n].sort(),
          );
        }}
      />
      <Text variant="small" color="textSecondary">
        Maximum time per session
      </Text>
      <SegmentedControl
        accessibilityLabel="Maximum session length"
        options={['20', '30', '45', '60', '90'].map((v) => ({ value: v, label: `${v} min` }))}
        value={String(minutes)}
        onChange={(v) => setMinutes(Number(v))}
      />
      <Text variant="caption" color="textSecondary">
        Your weekly plan is regenerated around your games, practices, fixed activities and injuries
        when you save.
      </Text>
    </Screen>
  );
}

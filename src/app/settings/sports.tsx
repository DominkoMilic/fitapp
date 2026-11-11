import { useState } from 'react';

import { ErrorState, LoadingState } from '@/components/feedback';
import { Button, Screen, Text } from '@/components/ui';
import { usePreferences, useUpdatePreferences } from '@/features/profile/api';
import { SaveState } from '@/features/profile/SaveState';
import { SportsPicker } from '@/features/sports/SportsPicker';
import { WeeklyEventsEditor } from '@/features/sports/WeeklyEventsEditor';

/** Which sports the user plays (any number, or none). Saving regenerates the weekly plan. */
export default function SportsSettings() {
  const prefs = usePreferences();
  if (prefs.isPending)
    return (
      <Screen edges={['bottom']}>
        <LoadingState />
      </Screen>
    );
  if (prefs.isError)
    return (
      <Screen edges={['bottom']}>
        <ErrorState
          message="Your sports couldn't be loaded."
          onRetry={() => void prefs.refetch()}
        />
      </Screen>
    );
  return <Form initial={prefs.data?.sports ?? []} />;
}

function Form({ initial }: { initial: string[] }) {
  const update = useUpdatePreferences();
  const [sports, setSports] = useState<string[]>(initial);
  const changed = sports.join(',') !== initial.join(',');
  return (
    <Screen
      locked={update.isPending}
      edges={['bottom']}
      footer={
        <Button
          title="Save"
          disabled={!changed}
          loading={update.isPending}
          onPress={() => update.mutate({ sports })}
        />
      }
    >
      <Text color="textSecondary">
        PACE plans rest and recovery around your games and practices, suggests drills for your
        sports, and checks injuries against the body areas each sport loads. Add your weekly games
        and fixed activities below.
      </Text>
      <SportsPicker value={sports} onChange={setSports} />
      <SaveState status={update.status} error={update.error} />
      <WeeklyEventsEditor sports={sports} />
    </Screen>
  );
}

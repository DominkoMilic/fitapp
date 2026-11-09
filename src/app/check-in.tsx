import { Stack } from 'expo-router';
import { useState } from 'react';

import { goBack } from '@/navigation/back';
import { Banner, LoadingState, useToast } from '@/components/feedback';
import {
  Button,
  ChipGroup,
  NumberField,
  Screen,
  SegmentedControl,
  Text,
  TextField,
} from '@/components/ui';
import { checkinGuidance, type CheckinValues, validateCheckin } from '@/domain/checkin/checkin';
import { BODY_AREA_LABELS, type BodyArea } from '@/domain/training/injury';
import { BODY_AREAS } from '@/domain/validation/onboarding';
import { type Checkin, useCheckins, useSaveCheckin } from '@/features/checkin/api';
import { useToday } from '@/features/dashboard/useToday';
import { useTheme } from '@/theme';
import { useSubmit } from '@/hooks/useSubmit';
import { LoadErrorBanner } from '@/components/feedback/LoadErrorBanner';

const SCALE = ['1', '2', '3', '4', '5'] as const;

export default function CheckinScreen() {
  const { today } = useToday();
  const checkins = useCheckins();
  const { colors } = useTheme();
  const existing = checkins.rows.find((c) => c.local_date === today);
  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Daily check-in',
          presentation: 'modal',
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.textPrimary,
        }}
      />
      {checkins.isPending ? (
        <Screen edges={['bottom']}>
          <LoadingState />
        </Screen>
      ) : (
        // Keyed by date only: saving creates today's check-in, which must not remount the form.
        <CheckinForm key={today} today={today} existing={existing} />
      )}
    </>
  );
}

function CheckinForm({ today, existing }: { today: string; existing: Checkin | undefined }) {
  const checkins = useCheckins(); // same cached query; used for the load-error banner
  const save = useSaveCheckin();
  const showToast = useToast((s) => s.show);
  const [v, setV] = useState<CheckinValues>({
    sleepHours: existing?.sleep_hours != null ? Number(existing.sleep_hours) : null,
    fatigue: existing?.fatigue ?? null,
    soreness: existing?.soreness ?? null,
    pain: existing?.pain ?? null,
    painArea: existing?.pain_area ?? null,
    note: existing?.note ?? '',
  });
  const [errors, setErrors] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const guidance = checkinGuidance(v);

  const onSave = async () => {
    const issues = validateCheckin(v);
    if (issues.length) {
      setErrors(
        issues.map(
          (i) =>
            ({
              sleep_range: 'Sleep must be between 0 and 24 hours',
              fatigue_range: 'Choose tiredness from 1 to 5',
              soreness_range: 'Choose soreness from 1 to 5',
              pain_range: 'Choose pain from 0 to 10',
              pain_area_missing: 'Where is the pain?',
              empty: 'Fill in at least one item',
            })[i],
        ),
      );
      return;
    }
    setErrors([]);
    await save(today, v);
    if (guidance?.tone === 'warning') {
      setSaved(true); // keep the safety message on screen
    } else {
      goBack('/home');
      showToast('Check-in saved');
    }
  };
  const submit = useSubmit(onSave);

  return (
    <Screen
      edges={['bottom']}
      footer={
        saved ? (
          <Button title="Done" onPress={() => goBack('/home')} />
        ) : (
          <Button title="Save check-in" loading={submit.busy} onPress={() => void submit.run()} />
        )
      }
    >
      <LoadErrorBanner
        visible={checkins.isError}
        what="today's check-in"
        onRetry={() => void checkins.refetch()}
      />
      {saved ? <Banner tone="success" message="Check-in saved." /> : null}
      {errors.map((e) => (
        <Banner key={e} tone="danger" message={e} />
      ))}
      <Text variant="small" color="textSecondary">
        Optional, takes 20 seconds. It helps PACE suggest when to go easier.
      </Text>
      <NumberField
        label="Sleep last night"
        suffix="hours"
        value={v.sleepHours}
        onChangeValue={(sleepHours) => setV({ ...v, sleepHours })}
      />
      <Text variant="small" color="textSecondary">
        How tired are you? (1 = fresh, 5 = exhausted)
      </Text>
      <SegmentedControl
        accessibilityLabel="Tiredness"
        options={SCALE.map((s) => ({ value: s, label: s }))}
        value={v.fatigue === null ? null : (String(v.fatigue) as (typeof SCALE)[number])}
        onChange={(s) => setV({ ...v, fatigue: Number(s) })}
      />
      <Text variant="small" color="textSecondary">
        Muscle soreness (1 = none, 5 = very sore)
      </Text>
      <SegmentedControl
        accessibilityLabel="Soreness"
        options={SCALE.map((s) => ({ value: s, label: s }))}
        value={v.soreness === null ? null : (String(v.soreness) as (typeof SCALE)[number])}
        onChange={(s) => setV({ ...v, soreness: Number(s) })}
      />
      <Text variant="small" color="textSecondary">
        Pain right now (0 = none, 10 = worst)
      </Text>
      <ChipGroup
        accessibilityLabel="Pain level"
        options={Array.from({ length: 11 }, (_, n) => ({ value: String(n), label: String(n) }))}
        selected={v.pain === null ? [] : [String(v.pain)]}
        onToggle={(p) => setV({ ...v, pain: Number(p) })}
      />
      {v.pain !== null && v.pain > 0 ? (
        <ChipGroup
          accessibilityLabel="Where is the pain"
          options={BODY_AREAS.map((a) => ({ value: a, label: BODY_AREA_LABELS[a as BodyArea] }))}
          selected={v.painArea ? [v.painArea as BodyArea] : []}
          onToggle={(painArea) => setV({ ...v, painArea })}
        />
      ) : null}
      {guidance ? <Banner tone={guidance.tone} message={guidance.message} /> : null}
      <TextField
        label="Note (optional)"
        value={v.note}
        onChangeText={(note) => setV({ ...v, note })}
        maxLength={500}
      />
    </Screen>
  );
}

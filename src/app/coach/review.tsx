import { useState } from 'react';

import { Banner, ConfirmDialog, ErrorState, LoadingState, useToast } from '@/components/feedback';
import { Button, Card, ListItem, Screen, SectionHeader, Text } from '@/components/ui';
import { addDays } from '@/domain/calculations/dates';
import { type TargetAdjustment, useAdjustments, useDecideAdjustment } from '@/features/coach/api';
import { targetFor } from '@/features/dashboard/today';
import { useToday } from '@/features/dashboard/useToday';
import { useProfile, useTargetHistory } from '@/features/profile/api';
import { useWeightStats } from '@/features/weight/useWeightStats';
import { formatDateRange } from '@/domain/format';
import { kgToLb, type UnitSystem } from '@/domain/calculations/units';

const OUTCOME: Record<string, string> = {
  increase_fast_loss: 'Eat a little more',
  decrease_slow: 'Small reduction suggested',
  on_track: 'On track',
  low_adherence: 'Not enough complete days',
  recovery_hold: 'Keep target, rest more',
  not_enough_data: 'Not enough weigh-ins',
};
const STATUS: Record<string, string> = {
  proposed: 'Waiting for you',
  accepted: 'Accepted',
  rejected: 'Kept current target',
  superseded: 'Replaced by a newer review',
  no_change: 'No change',
};

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
const message = (a: TargetAdjustment) =>
  ((a.inputs as Record<string, unknown> | null)?.message as string | undefined) ??
  OUTCOME[a.reason_code] ??
  '';

function Details({ a, unit }: { a: TargetAdjustment; unit: UnitSystem }) {
  const inputs = (a.inputs ?? {}) as Record<string, unknown>;
  const complete = num(inputs.completeDays);
  const intake = num(inputs.meanIntakeKcal);
  const rate = num(a.actual_rate_kg_week);
  return (
    <>
      <Text variant="small" color="textSecondary">
        {formatDateRange(a.window_start, a.window_end)}
      </Text>
      <Text variant="small">
        Complete food days: {complete ?? '—'} of 21 ({Math.round(Number(a.adherence ?? 0) * 100)}%)
      </Text>
      {intake !== null ? (
        <Text variant="small">Average intake on those days: {Math.round(intake)} kcal</Text>
      ) : null}
      {rate !== null ? (
        <Text variant="small">
          Weight trend: {rate >= 0 ? 'losing' : 'gaining'}{' '}
          {unit === 'metric'
            ? `${Math.abs(rate).toFixed(2)} kg`
            : `${kgToLb(Math.abs(rate)).toFixed(2)} lb`}{' '}
          a week
        </Text>
      ) : null}
      {a.observed_tdee !== null ? (
        <Text variant="small">
          Your estimated daily burn: ≈ {Math.round(Number(a.observed_tdee))} kcal (estimate from
          intake and trend)
        </Text>
      ) : null}
    </>
  );
}

export default function Review() {
  const { today } = useToday();
  const adjustments = useAdjustments();
  const targets = useTargetHistory();
  const { current: weight } = useWeightStats('30D');
  const { accept, reject } = useDecideAdjustment();
  const unit = (useProfile().data?.unit_system ?? 'metric') as UnitSystem;
  const showToast = useToast((s) => s.show);
  const [confirm, setConfirm] = useState(false);

  if (adjustments.isPending || targets.isPending)
    return (
      <Screen edges={['bottom']}>
        <LoadingState />
      </Screen>
    );
  if (adjustments.isError)
    return (
      <Screen edges={['bottom']}>
        <ErrorState
          message="Your reviews could not be loaded. Check your connection."
          onRetry={() => void adjustments.refetch()}
        />
      </Screen>
    );

  const list = adjustments.data ?? [];
  const pending = list.find((a) => a.status === 'proposed') ?? null;
  const current = targetFor(targets.data ?? [], today);
  const tomorrow = addDays(today, 1);

  return (
    <Screen edges={['bottom']}>
      <Text color="textSecondary">
        Every two weeks PACE compares what you ate on complete days with your weight trend. It only
        suggests a change; your target never changes without you.
      </Text>

      {pending && current ? (
        <Card raised>
          <Text variant="small" color="accent">
            {OUTCOME[pending.reason_code]}
          </Text>
          <Text variant="title">
            {pending.current_kcal} → {pending.proposed_kcal} kcal a day
          </Text>
          <Text>{message(pending)}</Text>
          <Details a={pending} unit={unit} />
          {pending.current_kcal !== current.kcal ? (
            <Banner
              tone="warning"
              message="Your target changed since this review. Accepting will still set the suggested value."
            />
          ) : null}
          <Button title="Accept from tomorrow" onPress={() => setConfirm(true)} />
          <Button
            title="Keep my current target"
            variant="secondary"
            loading={reject.isPending}
            onPress={() =>
              reject.mutate(pending.id, {
                onSuccess: () => showToast('Kept your current target'),
                onError: () => showToast('Could not save. Check your connection.'),
              })
            }
          />
        </Card>
      ) : list[0] ? (
        <Card>
          <Text variant="small" color="accent">
            Latest review · {OUTCOME[list[0].reason_code]}
          </Text>
          <Text>{message(list[0])}</Text>
          <Details a={list[0]} unit={unit} />
        </Card>
      ) : (
        <Card>
          <Text>
            Your first review happens after 3 weeks on your current target, if you have a
            weight-loss goal. Weigh in most mornings and mark days complete in your food diary.
          </Text>
        </Card>
      )}

      {list.length > 1 || (list.length === 1 && pending) ? (
        <>
          <SectionHeader title="History" />
          {list
            .filter((a) => a !== pending)
            .map((a) => (
              <ListItem
                key={a.id}
                title={`${a.window_end} · ${OUTCOME[a.reason_code] ?? a.reason_code}`}
                subtitle={
                  a.proposed_kcal
                    ? `${a.current_kcal} → ${a.proposed_kcal} kcal · ${STATUS[a.status]}`
                    : STATUS[a.status]
                }
              />
            ))}
        </>
      ) : null}

      <ConfirmDialog
        visible={confirm}
        title="Change your target?"
        message={
          pending
            ? `From ${tomorrow} your daily target becomes ${pending.proposed_kcal} kcal. Protein and fat stay the same; carbs change.`
            : ''
        }
        confirmLabel="Change target"
        loading={accept.isPending}
        onCancel={() => setConfirm(false)}
        onConfirm={() => {
          if (!pending || !current) return;
          accept.mutate(
            {
              adjustment: pending,
              current,
              effectiveFrom: tomorrow,
              weightKg: weight?.kg ?? 70,
            },
            {
              onSuccess: () => {
                setConfirm(false);
                showToast(`New target from ${tomorrow}`);
              },
              onError: (e) => {
                setConfirm(false);
                showToast(
                  /14 days/.test(e.message)
                    ? 'Your target already changed in the last 14 days. PACE will review again later.'
                    : 'Could not change the target. Check your connection and try again.',
                );
              },
            },
          );
        }}
      />
    </Screen>
  );
}

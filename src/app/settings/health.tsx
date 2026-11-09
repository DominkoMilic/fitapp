import { randomUUID } from 'expo-crypto';
import { useState } from 'react';
import { View } from 'react-native';

import { Banner, ConfirmDialog, EmptyState, ErrorState, LoadingState } from '@/components/feedback';
import { Button, Card, ChipGroup, Screen, SegmentedControl, Text, Toggle } from '@/components/ui';
import { envResult } from '@/config/env';
import {
  AREA_RESTRICTIONS,
  BODY_AREA_LABELS,
  type BodyArea,
  INJURY_STATUS_INFO,
  type InjuryStatus,
} from '@/domain/training/injury';
import { BODY_AREAS } from '@/domain/validation/onboarding';
import { DISCLAIMER } from '@/features/onboarding/constants';
import { OptionCard } from '@/features/onboarding/components/OptionCard';
import {
  type HealthCondition,
  useDeleteAllHealthData,
  useDeleteHealthCondition,
  useHealthConditions,
  useHealthConsent,
  useRecordConsent,
  useUpsertHealthCondition,
} from '@/features/profile/api';
import { SaveState } from '@/features/profile/SaveState';
import { spacing } from '@/theme';
import { formatDate } from '@/domain/format';

const STATUSES: InjuryStatus[] = [
  'active',
  'recovering',
  'cleared_training',
  'cleared_sport',
  'resolved',
];
const legalVersion = envResult.ok ? envResult.env.legalVersion : 'unknown';

interface Editing {
  id: string;
  bodyArea: BodyArea;
  side: 'left' | 'right' | 'both' | 'na';
  status: InjuryStatus;
  painLevel: number | null;
  professionalClearance: boolean;
}

const fromRow = (h: HealthCondition): Editing => ({
  id: h.id,
  bodyArea: (h.body_area ?? 'other') as BodyArea,
  side: h.side as Editing['side'],
  status: h.status as InjuryStatus,
  painLevel: h.pain_level,
  professionalClearance: h.professional_clearance,
});

export default function HealthSettings() {
  const conditions = useHealthConditions();
  const consent = useHealthConsent();
  const upsert = useUpsertHealthCondition();
  const remove = useDeleteHealthCondition();
  const removeAll = useDeleteAllHealthData();
  const recordConsent = useRecordConsent();
  const [editing, setEditing] = useState<Editing | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  if (conditions.isPending || consent.isPending)
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  if (conditions.isError || consent.isError) {
    return (
      <Screen>
        <ErrorState
          message="We couldn't load your health information."
          onRetry={() => void conditions.refetch()}
        />
      </Screen>
    );
  }
  const list = conditions.data ?? [];
  const lastMutation = [upsert, remove, removeAll].find((m) => m.status !== 'idle');

  return (
    <Screen edges={['bottom']}>
      <Banner tone="info" title="Not medical advice" message={DISCLAIMER} />
      {lastMutation ? <SaveState status={lastMutation.status} error={lastMutation.error} /> : null}
      {!consent.data ? (
        <>
          <Text color="textSecondary">
            To store injuries, PACE needs your explicit consent to process health information. You
            can withdraw it at any time.
          </Text>
          <Button
            title="I consent to storing my health information"
            variant="secondary"
            loading={recordConsent.isPending}
            onPress={() =>
              recordConsent.mutate({ type: 'health_data', granted: true, legalVersion })
            }
          />
        </>
      ) : null}

      {list.length === 0 && consent.data && !editing ? (
        <EmptyState
          title="No injuries recorded"
          message="Add one so your plan avoids exercises that could aggravate it."
        />
      ) : null}

      {list.map((h) => (
        <Card key={h.id}>
          <Text variant="bodyStrong">
            {BODY_AREA_LABELS[(h.body_area ?? 'other') as BodyArea]}
            {h.side !== 'na' ? ` (${h.side})` : ''}
          </Text>
          <Text variant="small" color="textSecondary">
            {INJURY_STATUS_INFO[h.status as InjuryStatus].title}
            {h.pain_level !== null ? ` · pain ${h.pain_level}/10` : ''} · updated{' '}
            {formatDate(h.updated_at.slice(0, 10))}
          </Text>
          <View style={{ flexDirection: 'row', gap: spacing.xs }}>
            <Button
              title="Update"
              variant="ghost"
              fullWidth={false}
              onPress={() => setEditing(fromRow(h))}
            />
            <Button
              title="Delete"
              variant="ghost"
              fullWidth={false}
              onPress={() => setConfirmDelete(h.id)}
            />
          </View>
        </Card>
      ))}

      {editing ? (
        <Card raised>
          <ChipGroup
            accessibilityLabel="Body area"
            options={BODY_AREAS.map((a) => ({ value: a, label: BODY_AREA_LABELS[a as BodyArea] }))}
            selected={[editing.bodyArea]}
            onToggle={(bodyArea) => setEditing({ ...editing, bodyArea: bodyArea as BodyArea })}
          />
          <SegmentedControl
            accessibilityLabel="Side"
            options={[
              { value: 'left', label: 'Left' },
              { value: 'right', label: 'Right' },
              { value: 'both', label: 'Both' },
              { value: 'na', label: 'N/A' },
            ]}
            value={editing.side}
            onChange={(side) => setEditing({ ...editing, side })}
          />
          <View style={{ gap: spacing.xs }} accessibilityRole="radiogroup">
            {STATUSES.map((s) => (
              <OptionCard
                key={s}
                title={INJURY_STATUS_INFO[s].title}
                description={INJURY_STATUS_INFO[s].description}
                selected={editing.status === s}
                onPress={() => setEditing({ ...editing, status: s })}
              />
            ))}
          </View>
          {editing.status === 'cleared_sport' ? (
            <Banner
              tone="info"
              message="We recommend clearance from a healthcare professional before returning to matches."
            />
          ) : null}
          <Text variant="small" color="textSecondary">
            Pain right now (0–10)
          </Text>
          <ChipGroup
            accessibilityLabel="Pain level"
            options={Array.from({ length: 11 }, (_, n) => ({ value: String(n), label: String(n) }))}
            selected={editing.painLevel === null ? [] : [String(editing.painLevel)]}
            onToggle={(v) => setEditing({ ...editing, painLevel: Number(v) })}
          />
          {editing.painLevel !== null && editing.painLevel >= 4 ? (
            <Banner
              tone="warning"
              message="Pain of 4/10 or more: rest the area and consider getting it checked by a healthcare professional."
            />
          ) : null}
          <Toggle
            label="A professional has cleared me for this status"
            value={editing.professionalClearance}
            onChange={(professionalClearance) => setEditing({ ...editing, professionalClearance })}
          />
          <Button
            title="Save"
            loading={upsert.isPending}
            onPress={() =>
              upsert.mutate(
                {
                  id: editing.id,
                  kind: 'injury',
                  body_area: editing.bodyArea,
                  side: editing.side,
                  status: editing.status,
                  pain_level: editing.painLevel,
                  professional_clearance: editing.professionalClearance,
                  restriction_tags: [...AREA_RESTRICTIONS[editing.bodyArea]],
                  resolved_at:
                    editing.status === 'resolved' ? new Date().toISOString().slice(0, 10) : null,
                },
                { onSuccess: () => setEditing(null) },
              )
            }
          />
          <Button title="Cancel" variant="ghost" onPress={() => setEditing(null)} />
        </Card>
      ) : consent.data ? (
        <Button
          title="Add an injury"
          variant="secondary"
          onPress={() =>
            setEditing({
              id: randomUUID(),
              bodyArea: 'ankle_foot',
              side: 'right',
              status: 'recovering',
              painLevel: null,
              professionalClearance: false,
            })
          }
        />
      ) : null}

      {consent.data || list.length ? (
        <Button
          title="Delete all health information"
          variant="ghost"
          onPress={() => setConfirmAll(true)}
        />
      ) : null}
      <ConfirmDialog
        visible={confirmDelete !== null}
        destructive
        title="Delete this injury?"
        message="Your plan will stop adjusting for it. You can add it again at any time."
        confirmLabel="Delete"
        loading={remove.isPending}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => {
          if (confirmDelete)
            remove.mutate(confirmDelete, { onSettled: () => setConfirmDelete(null) });
        }}
      />
      <ConfirmDialog
        visible={confirmAll}
        destructive
        title="Delete all health information?"
        message="All injuries and conditions are permanently deleted and your health-data consent is withdrawn. Your plan is regenerated without injury adjustments."
        confirmLabel="Delete"
        loading={removeAll.isPending}
        onCancel={() => setConfirmAll(false)}
        onConfirm={() =>
          removeAll.mutate({ legalVersion }, { onSettled: () => setConfirmAll(false) })
        }
      />
    </Screen>
  );
}

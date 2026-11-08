import { randomUUID } from 'expo-crypto';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Banner } from '@/components/feedback';
import {
  Button,
  Card,
  ChipGroup,
  SegmentedControl,
  Text,
  TextField,
  Toggle,
} from '@/components/ui';
import {
  BODY_AREA_LABELS,
  INJURY_STATUS_INFO,
  type BodyArea,
  type InjuryStatus,
} from '@/domain/training/injury';
import { BODY_AREAS, injurySchema, type InjuryValues } from '@/domain/validation/onboarding';
import { DISCLAIMER } from '@/features/onboarding/constants';
import { OnboardingStep } from '@/features/onboarding/components/OnboardingStep';
import { OptionCard } from '@/features/onboarding/components/OptionCard';
import { useOnboardingDraft } from '@/features/onboarding/draft-store';
import { spacing } from '@/theme';

const STATUSES: InjuryStatus[] = ['active', 'recovering', 'cleared_training', 'cleared_sport'];

const newInjury = (): InjuryValues => ({
  id: randomUUID(),
  bodyArea: 'ankle_foot',
  side: 'right',
  status: 'recovering',
  painLevel: null,
  description: '',
  onsetDate: null,
  professionalClearance: false,
});

export default function HealthStep() {
  const saved = useOnboardingDraft((s) => s.health);
  const healthConsent = useOnboardingDraft((s) => s.healthConsent);
  const save = useOnboardingDraft((s) => s.save);
  const [injuries, setInjuries] = useState<InjuryValues[]>(saved?.injuries ?? []);
  const [editing, setEditing] = useState<InjuryValues | null>(null);
  const [error, setError] = useState<string | null>(null);

  const finish = (list: InjuryValues[]) => {
    save('health', { injuries: list });
    router.replace('/onboarding/consent');
  };

  const addInjury = () => {
    if (!editing) return;
    const parsed = injurySchema.safeParse(editing);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check the details');
      return;
    }
    setInjuries([...injuries.filter((i) => i.id !== parsed.data.id), parsed.data]);
    setEditing(null);
    setError(null);
  };

  return (
    <OnboardingStep
      step="health"
      title="Injuries and limitations"
      subtitle="Optional. If you record an injury, PACE leaves out exercises that could aggravate it."
      onContinue={() => finish(injuries)}
      onSkip={injuries.length === 0 ? () => finish([]) : undefined}
    >
      <Banner tone="info" title="Not medical advice" message={DISCLAIMER} />
      <Toggle
        label="Store my health information"
        description="Injury details are sensitive health data. PACE stores them privately so it can adapt your plan. You can delete them at any time."
        value={healthConsent}
        onChange={(v) => {
          save('healthConsent', v);
          if (!v) {
            setInjuries([]);
            setEditing(null);
          }
        }}
      />
      {healthConsent ? (
        <>
          {injuries.map((i) => (
            <Card key={i.id}>
              <Text variant="bodyStrong">
                {BODY_AREA_LABELS[i.bodyArea]}
                {i.side !== 'na' ? ` (${i.side})` : ''}
              </Text>
              <Text variant="small" color="textSecondary">
                {INJURY_STATUS_INFO[i.status].title}
                {i.painLevel !== null ? ` · pain ${i.painLevel}/10` : ''}
              </Text>
              <View style={{ flexDirection: 'row', gap: spacing.xs }}>
                <Button
                  title="Edit"
                  variant="ghost"
                  fullWidth={false}
                  onPress={() => setEditing(i)}
                />
                <Button
                  title="Remove"
                  variant="ghost"
                  fullWidth={false}
                  onPress={() => setInjuries(injuries.filter((x) => x.id !== i.id))}
                />
              </View>
            </Card>
          ))}
          {editing ? (
            <Card raised>
              {error ? <Banner tone="danger" message={error} /> : null}
              <Text variant="small" color="textSecondary">
                Where?
              </Text>
              <ChipGroup
                options={BODY_AREAS.map((a) => ({
                  value: a,
                  label: BODY_AREA_LABELS[a as BodyArea],
                }))}
                selected={[editing.bodyArea]}
                onToggle={(bodyArea) => setEditing({ ...editing, bodyArea })}
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
              <Text variant="small" color="textSecondary">
                Current status
              </Text>
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
              <Text variant="small" color="textSecondary">
                Pain right now (0 = none, 10 = worst)
              </Text>
              <ChipGroup
                options={Array.from({ length: 11 }, (_, n) => ({
                  value: String(n),
                  label: String(n),
                }))}
                selected={editing.painLevel === null ? [] : [String(editing.painLevel)]}
                onToggle={(v) => setEditing({ ...editing, painLevel: Number(v) })}
              />
              {editing.painLevel !== null && editing.painLevel >= 4 ? (
                <Banner
                  tone="warning"
                  message="Pain of 4/10 or more: rest the area and consider getting it checked by a healthcare professional."
                />
              ) : null}
              <TextField
                label="Notes (optional)"
                value={editing.description}
                onChangeText={(description) => setEditing({ ...editing, description })}
                maxLength={500}
                multiline
              />
              <Toggle
                label="A professional has cleared me for my current status"
                value={editing.professionalClearance}
                onChange={(professionalClearance) =>
                  setEditing({ ...editing, professionalClearance })
                }
              />
              <Button title="Save injury" onPress={addInjury} />
              <Button title="Cancel" variant="ghost" onPress={() => setEditing(null)} />
            </Card>
          ) : injuries.length < 10 ? (
            <Button
              title="Add an injury"
              variant="secondary"
              onPress={() => setEditing(newInjury())}
            />
          ) : null}
        </>
      ) : null}
    </OnboardingStep>
  );
}

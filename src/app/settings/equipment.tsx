import { useState } from 'react';

import { ErrorState, LoadingState } from '@/components/feedback';
import { Button, ChipGroup, NumberField, Screen } from '@/components/ui';
import type { EquipmentType } from '@/domain/validation/onboarding';
import { type Equipment, useEquipment, useReplaceEquipment } from '@/features/profile/api';
import { SaveState } from '@/features/profile/SaveState';

const OPTIONS: { value: Exclude<EquipmentType, 'custom'>; label: string }[] = [
  { value: 'none', label: 'No equipment' },
  { value: 'dumbbells', label: 'Dumbbells' },
  { value: 'kettlebell', label: 'Kettlebell' },
  { value: 'resistance_bands', label: 'Resistance bands' },
  { value: 'exercise_mat', label: 'Exercise mat' },
  { value: 'bench', label: 'Bench' },
  { value: 'pull_up_bar', label: 'Pull-up bar' },
  { value: 'barbell', label: 'Barbell' },
  { value: 'jump_rope', label: 'Jump rope' },
  { value: 'treadmill', label: 'Treadmill' },
  { value: 'exercise_bike', label: 'Exercise bike' },
  { value: 'football', label: 'Ball (any sport)' },
  { value: 'racket', label: 'Racket' },
  { value: 'stick', label: 'Stick (hockey)' },
  { value: 'cones', label: 'Cones' },
];
const WEIGHTED = ['dumbbells', 'kettlebell', 'barbell'];

export default function EquipmentSettings() {
  const equipment = useEquipment();
  if (equipment.isPending)
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  if (equipment.isError)
    return (
      <Screen>
        <ErrorState
          message="We couldn't load your equipment."
          onRetry={() => void equipment.refetch()}
        />
      </Screen>
    );
  return <EquipmentForm initial={equipment.data ?? []} />;
}

function EquipmentForm({ initial }: { initial: Equipment[] }) {
  const replace = useReplaceEquipment();
  const [items, setItems] = useState(
    initial.map((e) => ({
      type: e.equipment_type,
      customName: e.custom_name,
      maxWeightKg: e.max_weight_kg === null ? null : Number(e.max_weight_kg),
    })),
  );
  const toggle = (type: string) => {
    if (items.some((i) => i.type === type)) setItems(items.filter((i) => i.type !== type));
    else if (type === 'none') setItems([{ type: 'none', customName: null, maxWeightKg: null }]);
    else
      setItems([
        ...items.filter((i) => i.type !== 'none'),
        { type, customName: null, maxWeightKg: null },
      ]);
  };
  return (
    <Screen
      locked={replace.isPending}
      edges={['bottom']}
      footer={
        <Button
          title="Save"
          loading={replace.isPending}
          onPress={() =>
            replace.mutate(
              items.map((i) => ({
                equipment_type: i.type,
                custom_name: i.customName,
                max_weight_kg: i.maxWeightKg,
              })),
            )
          }
        />
      }
    >
      <SaveState status={replace.status} error={replace.error} />
      <ChipGroup
        options={OPTIONS}
        selected={items.map((i) => i.type) as EquipmentType[]}
        onToggle={toggle}
      />
      {items.map((item, idx) =>
        WEIGHTED.includes(item.type) ? (
          <NumberField
            key={item.type}
            label={`Heaviest ${OPTIONS.find((o) => o.value === item.type)?.label.toLowerCase()} (optional)`}
            suffix="kg"
            value={item.maxWeightKg}
            onChangeValue={(v) =>
              setItems(items.map((x, j) => (j === idx ? { ...x, maxWeightKg: v } : x)))
            }
          />
        ) : null,
      )}
    </Screen>
  );
}

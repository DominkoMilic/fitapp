import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { View } from 'react-native';

import { Button, ChipGroup, NumberField, SegmentedControl, Text, TextField } from '@/components/ui';
import {
  equipmentSchema,
  type EquipmentType,
  type EquipmentValues,
} from '@/domain/validation/onboarding';
import { OnboardingStep } from '@/features/onboarding/components/OnboardingStep';
import { useOnboardingDraft } from '@/features/onboarding/draft-store';
import { spacing } from '@/theme';

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
  { value: 'football', label: 'Ball' },
  { value: 'cones', label: 'Cones' },
];
const WEIGHTED: EquipmentType[] = ['dumbbells', 'kettlebell', 'barbell'];

export default function EquipmentStep() {
  const saved = useOnboardingDraft((s) => s.equipment);
  const save = useOnboardingDraft((s) => s.save);
  const [custom, setCustom] = useState('');
  const { control, handleSubmit, setValue } = useForm<EquipmentValues>({
    resolver: zodResolver(equipmentSchema),
    defaultValues: saved ?? { environment: 'home', items: [] },
  });
  const items = useWatch({ control, name: 'items' });

  const toggle = (type: EquipmentType) => {
    if (items.some((i) => i.type === type)) {
      setValue(
        'items',
        items.filter((i) => i.type !== type),
        { shouldValidate: true },
      );
    } else if (type === 'none') {
      setValue('items', [{ type: 'none', customName: null, maxWeightKg: null }], {
        shouldValidate: true,
      });
    } else {
      setValue(
        'items',
        [...items.filter((i) => i.type !== 'none'), { type, customName: null, maxWeightKg: null }],
        {
          shouldValidate: true,
        },
      );
    }
  };

  const onContinue = handleSubmit((values) => {
    save('equipment', values);
    router.replace('/onboarding/schedule');
  });

  return (
    <OnboardingStep
      step="equipment"
      title="Where and with what do you train?"
      subtitle="Workouts only use equipment you have."
      onContinue={() => void onContinue()}
    >
      <Controller
        control={control}
        name="environment"
        render={({ field }) => (
          <SegmentedControl
            accessibilityLabel="Training environment"
            options={[
              { value: 'home', label: 'Home' },
              { value: 'gym', label: 'Gym' },
              { value: 'outdoors', label: 'Outdoors' },
              { value: 'mixed', label: 'Mixed' },
            ]}
            value={field.value}
            onChange={field.onChange}
          />
        )}
      />
      <ChipGroup options={OPTIONS} selected={items.map((i) => i.type)} onToggle={toggle} />
      {items
        .map((item, idx) => ({ item, idx }))
        .filter(({ item }) => WEIGHTED.includes(item.type))
        .map(({ item, idx }) => (
          <NumberField
            key={item.type}
            label={`Heaviest ${OPTIONS.find((o) => o.value === item.type)?.label.toLowerCase() ?? item.type} (optional)`}
            suffix="kg"
            value={item.maxWeightKg}
            onChangeValue={(v) => setValue(`items.${idx}.maxWeightKg`, v)}
          />
        ))}
      <Text variant="small" color="textSecondary">
        Something else?
      </Text>
      <View style={{ flexDirection: 'row', gap: spacing.xs, alignItems: 'flex-end' }}>
        <View style={{ flex: 1 }}>
          <TextField
            label="Custom equipment"
            value={custom}
            onChangeText={setCustom}
            maxLength={60}
          />
        </View>
        <Button
          title="Add"
          variant="secondary"
          fullWidth={false}
          disabled={!custom.trim()}
          onPress={() => {
            setValue('items', [
              ...items.filter((i) => i.type !== 'none'),
              { type: 'custom', customName: custom.trim(), maxWeightKg: null },
            ]);
            setCustom('');
          }}
        />
      </View>
      {items
        .filter((i) => i.type === 'custom')
        .map((i) => (
          <Button
            key={i.customName}
            title={`Remove ${i.customName}`}
            variant="ghost"
            fullWidth={false}
            onPress={() =>
              setValue(
                'items',
                items.filter((x) => x !== i),
              )
            }
          />
        ))}
    </OnboardingStep>
  );
}

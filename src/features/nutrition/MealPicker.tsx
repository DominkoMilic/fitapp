import { SegmentedControl } from '@/components/ui';
import { MEAL_LABELS, MEAL_TYPES, type MealType } from '@/domain/nutrition/totals';

export function MealPicker({
  value,
  onChange,
}: {
  value: MealType;
  onChange: (m: MealType) => void;
}) {
  return (
    <SegmentedControl<MealType>
      accessibilityLabel="Meal"
      options={MEAL_TYPES.map((m) => ({ value: m, label: MEAL_LABELS[m] }))}
      value={value}
      onChange={onChange}
    />
  );
}

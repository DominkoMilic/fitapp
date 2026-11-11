import { router } from 'expo-router';
import { useState } from 'react';

import { Banner, useToast } from '@/components/feedback';
import {
  Button,
  ChipGroup,
  Screen,
  SegmentedControl,
  Text,
  TextField,
  Toggle,
} from '@/components/ui';
import type { ExerciseCategory, TrackingType } from '@/domain/training/catalogue';
import { useCustomExerciseActions } from '@/features/training/library';
import { useSubmit } from '@/hooks/useSubmit';
import { useFieldErrors } from '@/hooks/useFieldErrors';

const CATEGORIES: { value: ExerciseCategory; label: string }[] = [
  { value: 'strength', label: 'Strength' },
  { value: 'core', label: 'Core' },
  { value: 'mobility', label: 'Mobility' },
  { value: 'conditioning', label: 'Conditioning' },
  { value: 'cardio', label: 'Cardio' },
  { value: 'sport_skills', label: 'Sport drill' },
];
const EQUIPMENT = [
  { value: 'dumbbells', label: 'Dumbbells' },
  { value: 'kettlebell', label: 'Kettlebell' },
  { value: 'resistance_bands', label: 'Band' },
  { value: 'bench', label: 'Bench' },
  { value: 'pull_up_bar', label: 'Pull-up bar' },
  { value: 'barbell', label: 'Barbell' },
] as const;

export default function NewExercise() {
  const actions = useCustomExerciseActions();
  const showToast = useToast((s) => s.show);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<ExerciseCategory>('strength');
  const [tracking, setTracking] = useState<TrackingType>('reps_weight');
  const [equipment, setEquipment] = useState<string[]>([]);
  const [muscles, setMuscles] = useState('');
  const [instructions, setInstructions] = useState('');
  const [caution, setCaution] = useState('');
  const [unilateral, setUnilateral] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fields = useFieldErrors<'name'>();

  const save = async () => {
    setError(null);
    if (
      !fields.show(
        !name.trim() || name.trim().length > 80
          ? { name: 'Enter a name (up to 80 characters)' }
          : {},
      )
    )
      return;
    const slug = await actions.create({
      name,
      category,
      tracking,
      equipment,
      muscleGroups: muscles
        .split(',')
        .map((m) => m.trim().toLowerCase())
        .filter(Boolean),
      instructions: instructions
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean),
      caution,
      unilateral,
    });
    router.replace({ pathname: '/training/exercise/[slug]', params: { slug } });
    showToast('Exercise added to your library');
  };
  const submit = useSubmit(save);

  return (
    <Screen
      locked={submit.busy}
      edges={['bottom']}
      footer={
        <Button title="Save exercise" loading={submit.busy} onPress={() => void submit.run()} />
      }
    >
      {error ? <Banner tone="danger" message={error} /> : null}
      <TextField
        label="Name"
        value={name}
        onChangeText={(t) => {
          setName(t);
          fields.clear('name');
        }}
        maxLength={80}
        error={fields.errors.name}
      />
      <ChipGroup
        accessibilityLabel="Category"
        options={CATEGORIES}
        selected={[category]}
        onToggle={setCategory}
      />
      <Text variant="small" color="textSecondary">
        Track by
      </Text>
      <SegmentedControl<TrackingType>
        accessibilityLabel="Track by"
        options={[
          { value: 'reps_weight', label: 'Reps + weight' },
          { value: 'reps', label: 'Reps' },
          { value: 'time', label: 'Time' },
        ]}
        value={tracking}
        onChange={setTracking}
      />
      <Text variant="small" color="textSecondary">
        Equipment needed
      </Text>
      <ChipGroup
        accessibilityLabel="Equipment needed"
        options={EQUIPMENT}
        selected={equipment as (typeof EQUIPMENT)[number]['value'][]}
        onToggle={(v) =>
          setEquipment(equipment.includes(v) ? equipment.filter((x) => x !== v) : [...equipment, v])
        }
      />
      <TextField label="Muscles (comma separated)" value={muscles} onChangeText={setMuscles} />
      <TextField
        label="Instructions (one step per line)"
        value={instructions}
        onChangeText={setInstructions}
        multiline
      />
      <TextField label="Caution notes (optional)" value={caution} onChangeText={setCaution} />
      <Toggle label="One side at a time" value={unilateral} onChange={setUnilateral} />
    </Screen>
  );
}

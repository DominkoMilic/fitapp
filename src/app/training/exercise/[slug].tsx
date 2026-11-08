import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { Banner, ConfirmDialog, ErrorState } from '@/components/feedback';
import { Button, Card, Screen, SectionHeader, Text } from '@/components/ui';
import { isContraindicated, type RestrictionTag } from '@/domain/training/injury';
import { equipmentSatisfied } from '@/domain/training/workout-builder';
import {
  useCustomExerciseActions,
  useLibrary,
  useOwnedEquipment,
  useRestrictions,
} from '@/features/training/library';

const EQUIPMENT_LABELS: Record<string, string> = {
  dumbbells: 'dumbbells',
  kettlebell: 'kettlebell',
  resistance_bands: 'resistance band',
  barbell: 'barbell',
  bench: 'bench',
  exercise_mat: 'mat',
  pull_up_bar: 'pull-up bar',
  treadmill: 'treadmill',
  exercise_bike: 'exercise bike',
  jump_rope: 'jump rope',
  football: 'ball',
  cones: 'cones',
};
const equipmentText = (req: string[]) =>
  req.length
    ? req
        .map((r) =>
          r
            .split('|')
            .map((x) => EQUIPMENT_LABELS[x] ?? x)
            .join(' or '),
        )
        .join(' + ')
    : 'None (bodyweight)';

export default function ExerciseDetail() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { lookup, custom } = useLibrary();
  const restrictions = useRestrictions();
  const owned = useOwnedEquipment();
  const actions = useCustomExerciseActions();
  const [confirmArchive, setConfirmArchive] = useState(false);
  const e = slug ? lookup(slug) : undefined;
  if (!e)
    return (
      <Screen edges={['bottom']}>
        <ErrorState title="Exercise not found" message="It may have been removed." />
      </Screen>
    );
  const restricted = isContraindicated(e.contraindications as RestrictionTag[], restrictions.tags);
  const row = e.custom ? custom.rows.find((r) => r.id === e.id) : undefined;

  return (
    <Screen edges={['bottom']}>
      <Text variant="heading" accessibilityRole="header">
        {e.name}
      </Text>
      <Text color="textSecondary">
        {e.category} · {e.difficulty} · {e.muscleGroups.join(', ')}
      </Text>
      {restricted ? (
        <Banner
          tone="warning"
          title="Not for your current injury"
          message="PACE leaves this out of your workouts until your injury status allows it."
        />
      ) : null}
      {!equipmentSatisfied(e.equipment, owned) ? (
        <Banner tone="info" message={`Needs: ${equipmentText(e.equipment)}.`} />
      ) : null}
      <Card>
        <Text variant="small" color="textSecondary">
          Default
        </Text>
        <Text variant="bodyStrong">
          {e.defaultSets} ×{' '}
          {e.tracking === 'time' ? `${e.durationS} s` : `${e.repsMin}–${e.repsMax} reps`}
          {e.unilateral ? ' per side' : ''}
        </Text>
        <Text variant="small" color="textSecondary">
          Equipment: {equipmentText(e.equipment)}
        </Text>
      </Card>
      {e.instructions.length ? (
        <>
          <SectionHeader title="How to" />
          {e.instructions.map((step, i) => (
            <Text key={i}>
              {i + 1}. {step}
            </Text>
          ))}
        </>
      ) : null}
      {e.caution ? <Banner tone="info" title="Caution" message={e.caution} /> : null}
      {row && !row.archived_at ? (
        <>
          <Button
            title="Remove from my library"
            variant="ghost"
            onPress={() => setConfirmArchive(true)}
          />
          <ConfirmDialog
            visible={confirmArchive}
            title="Remove this exercise?"
            message="It disappears from the library. Past workouts keep it in their history."
            confirmLabel="Remove"
            destructive
            onCancel={() => setConfirmArchive(false)}
            onConfirm={async () => {
              await actions.archive(row);
              setConfirmArchive(false);
              router.back();
            }}
          />
        </>
      ) : null}
    </Screen>
  );
}

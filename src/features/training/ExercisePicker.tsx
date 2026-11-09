import { useMemo, useState } from 'react';

import { Button, Card, ListItem, Text, TextField } from '@/components/ui';
import type { ExerciseToAdd } from '@/domain/training/active-workout';
import { categoryLabel } from '@/domain/format';

import { isContraindicated, type RestrictionTag } from '@/domain/training/injury';

import { useLibrary, useRestrictions } from './library';

/** Search the exercise library (system and your own) and pick one to add (spec 10.4). */
export function ExercisePicker({
  onPick,
  onCancel,
}: {
  onPick: (e: ExerciseToAdd) => void;
  onCancel: () => void;
}) {
  const { list } = useLibrary();
  const restrictions = useRestrictions();
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const matches = useMemo(
    () =>
      list
        .filter(
          (e) =>
            !q || e.name.toLowerCase().includes(q) || e.muscleGroups.some((m) => m.includes(q)),
        )
        .sort((a, b) => a.name.localeCompare(b.name))
        .slice(0, q ? 20 : 12),
    [list, q],
  );
  return (
    <Card raised>
      <Text variant="bodyStrong">Add an exercise</Text>
      <TextField
        label="Search exercises"
        placeholder="e.g. push-up, plank, squat"
        value={query}
        onChangeText={setQuery}
        autoCorrect={false}
        autoFocus
      />
      {matches.length === 0 ? (
        <Text color="textSecondary">
          No exercise matches. You can create your own in Training → Exercise library.
        </Text>
      ) : null}
      {matches.map((e) => (
        <ListItem
          key={e.slug}
          title={e.name}
          subtitle={`${categoryLabel(e.category)} · ${e.muscleGroups.slice(0, 3).join(', ')}${
            isContraindicated(e.contraindications as RestrictionTag[], restrictions.tags)
              ? ' · not for your current injury'
              : ''
          }`}
          onPress={() =>
            onPick({
              slug: e.slug,
              name: e.name,
              tracking: e.tracking,
              unilateral: e.unilateral,
              defaultSets: e.defaultSets,
              repsMin: e.repsMin,
              repsMax: e.repsMax,
              durationS: e.durationS,
            })
          }
        />
      ))}
      <Button title="Cancel" variant="ghost" onPress={onCancel} />
    </Card>
  );
}

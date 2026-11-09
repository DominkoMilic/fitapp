import { router } from 'expo-router';
import { useMemo, useState } from 'react';

import { EmptyState } from '@/components/feedback';
import { Button, ChipGroup, ListItem, ListScreen, TextField, Toggle } from '@/components/ui';
import type { ExerciseCategory } from '@/domain/training/catalogue';
import { isContraindicated, type RestrictionTag } from '@/domain/training/injury';
import { equipmentSatisfied } from '@/domain/training/workout-builder';
import { useLibrary, useOwnedEquipment, useRestrictions } from '@/features/training/library';

const CATEGORIES: { value: ExerciseCategory; label: string }[] = [
  { value: 'strength', label: 'Strength' },
  { value: 'core', label: 'Core' },
  { value: 'mobility', label: 'Mobility' },
  { value: 'conditioning', label: 'Conditioning' },
  { value: 'cardio', label: 'Cardio' },
  { value: 'sport_skills', label: 'Sport drills' },
  { value: 'recovery', label: 'Recovery' },
];

export default function ExerciseLibrary() {
  const { list } = useLibrary();
  const restrictions = useRestrictions();
  const owned = useOwnedEquipment();
  const [query, setQuery] = useState('');
  const [categories, setCategories] = useState<ExerciseCategory[]>([]);
  const [safeOnly, setSafeOnly] = useState(restrictions.tags.length > 0);
  const [mineOnly, setMineOnly] = useState(false);
  // Sport drills for sports the user doesn't play are hidden by default (sports load async).
  const [mySportsPref, setMySportsOnly] = useState<boolean | null>(null);
  const mySportsOnly = mySportsPref ?? restrictions.sports.length > 0;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return list
      .filter(
        (e) => !q || e.name.toLowerCase().includes(q) || e.muscleGroups.some((m) => m.includes(q)),
      )
      .filter(
        (e) =>
          !categories.length ||
          categories.includes(e.category) ||
          (e.category === 'football' && categories.includes('sport_skills')),
      )
      .filter(
        (e) =>
          !safeOnly ||
          !isContraindicated(e.contraindications as RestrictionTag[], restrictions.tags),
      )
      .filter((e) => !mineOnly || equipmentSatisfied(e.equipment, owned))
      .filter(
        (e) =>
          !mySportsOnly ||
          !e.sports?.length ||
          e.sports.some((k) => restrictions.sports.includes(k)),
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [
    list,
    query,
    categories,
    safeOnly,
    mineOnly,
    mySportsOnly,
    restrictions.tags,
    restrictions.sports,
    owned,
  ]);

  return (
    <ListScreen
      data={filtered}
      keyExtractor={(e) => e.slug}
      footer={
        <Button
          title="Create custom exercise"
          variant="secondary"
          onPress={() => router.push('/training/exercise-new')}
        />
      }
      header={
        <>
          <TextField
            label="Search"
            placeholder="Name or muscle"
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
          />
          <ChipGroup
            accessibilityLabel="Categories"
            options={CATEGORIES}
            selected={categories}
            onToggle={(c) =>
              setCategories(
                categories.includes(c) ? categories.filter((x) => x !== c) : [...categories, c],
              )
            }
          />
          {restrictions.tags.length ? (
            <Toggle label="Safe for my injuries" value={safeOnly} onChange={setSafeOnly} />
          ) : null}
          <Toggle label="Only equipment I have" value={mineOnly} onChange={setMineOnly} />
          {restrictions.sports.length ? (
            <Toggle
              label="Only drills for my sports"
              value={mySportsOnly}
              onChange={setMySportsOnly}
            />
          ) : null}
        </>
      }
      empty={
        <EmptyState title="No exercises found" message="Try another search or fewer filters." />
      }
      renderItem={(e) => {
        const restricted = isContraindicated(
          e.contraindications as RestrictionTag[],
          restrictions.tags,
        );
        return (
          <ListItem
            title={e.name}
            subtitle={`${e.muscleGroups.join(', ')}${e.custom ? ' · custom' : ''}${restricted ? ' · not for your current injury' : ''}`}
            onPress={() =>
              router.push({ pathname: '/training/exercise/[slug]', params: { slug: e.slug } })
            }
          />
        );
      }}
    />
  );
}

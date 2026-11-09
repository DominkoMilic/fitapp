import { StyleSheet, View } from 'react-native';

import { ChipGroup, SegmentedControl } from '@/components/ui';
import {
  parseSportCategory,
  SPORT_BY_KEY,
  sportCategory,
  type SportEventType,
} from '@/domain/sports/catalogue';
import { spacing } from '@/theme';

const ACTIVITIES = [
  { value: 'run', label: 'Run' },
  { value: 'walk', label: 'Walk' },
  { value: 'cycle', label: 'Ride' },
  { value: 'workout', label: 'Workout' },
  { value: 'other', label: 'Something else' },
] as const;

/**
 * What a calendar commitment is: one of the user's sports (then game/practice in that sport's
 * own words) or a fixed activity. Value is the stored category ('basketball_match', 'run', …).
 */
export function CommitmentTypePicker({
  sports,
  value,
  onChange,
}: {
  sports: readonly string[];
  value: string;
  onChange: (category: string, defaultIntensity: 'easy' | 'moderate' | 'hard') => void;
}) {
  const parsed = parseSportCategory(value);
  const selectedKey = parsed ? parsed.sport.key : value;
  const sportOptions = sports
    .filter((k) => SPORT_BY_KEY[k])
    .map((k) => ({ value: k, label: SPORT_BY_KEY[k]!.label }));
  // A sport already used on this item stays selectable even if removed from the list since.
  if (parsed && !sports.includes(parsed.sport.key))
    sportOptions.unshift({ value: parsed.sport.key, label: parsed.sport.label });

  return (
    <View style={styles.stack}>
      <ChipGroup
        accessibilityLabel="What is it?"
        single
        options={[...sportOptions, ...ACTIVITIES]}
        selected={[selectedKey]}
        onToggle={(k) => {
          if (SPORT_BY_KEY[k]) onChange(sportCategory(k, parsed?.type ?? 'match'), 'hard');
          else onChange(k, 'moderate');
        }}
      />
      {parsed ? (
        <SegmentedControl<SportEventType>
          accessibilityLabel="Game or practice"
          options={[
            { value: 'match', label: parsed.sport.eventLabels.match },
            { value: 'practice', label: parsed.sport.eventLabels.practice },
          ]}
          value={parsed.type}
          onChange={(t) => onChange(sportCategory(parsed.sport.key, t), 'hard')}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({ stack: { gap: spacing.xs } });

import { ChipGroup, SegmentedControl, Text, TextField } from '@/components/ui';

/** RPE, how you feel and notes: the same questions after any workout (spec 10.4). */
export function EffortFields({
  rpe,
  feeling,
  notes,
  onRpe,
  onFeeling,
  onNotes,
}: {
  rpe: number | null;
  feeling: number | null;
  notes: string;
  onRpe: (v: number) => void;
  onFeeling: (v: number) => void;
  onNotes: (v: string) => void;
}) {
  return (
    <>
      <Text variant="small" color="textSecondary">
        How hard was it overall? (RPE 0–10)
      </Text>
      <ChipGroup
        accessibilityLabel="Effort (RPE)"
        single
        options={Array.from({ length: 11 }, (_, n) => ({ value: String(n), label: String(n) }))}
        selected={rpe === null ? [] : [String(rpe)]}
        onToggle={(v) => onRpe(Number(v))}
      />
      <Text variant="small" color="textSecondary">
        How do you feel? (1 = drained, 5 = great)
      </Text>
      <SegmentedControl
        accessibilityLabel="How do you feel"
        options={['1', '2', '3', '4', '5'].map((v) => ({ value: v, label: v }))}
        value={feeling === null ? null : String(feeling)}
        onChange={(v) => onFeeling(Number(v))}
      />
      <TextField
        label="Notes (optional)"
        value={notes}
        onChangeText={onNotes}
        maxLength={1000}
        multiline
      />
    </>
  );
}

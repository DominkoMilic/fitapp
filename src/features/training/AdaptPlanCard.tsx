import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useToast } from '@/components/feedback';
import { Button, Card, Text, Toggle } from '@/components/ui';
import { spacing } from '@/theme';

import { dayLabel } from './labels';
import { usePlanAdaptation } from './usePlanAdaptation';
import { useToday } from '@/features/dashboard/useToday';

/**
 * "Adjust your plan?" after a session that wasn't planned (2026-11-12): each suggested change
 * with its reason, all ticked; Apply changes only what's ticked, Keep my plan changes nothing.
 */
export function AdaptPlanCard() {
  const { suggestion, apply, decline } = usePlanAdaptation();
  const { today } = useToday();
  const showToast = useToast((s) => s.show);
  const [off, setOff] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  // Keys include the logged session's id, so choices never leak into the next suggestion.

  if (!suggestion) return null;
  const chosen = suggestion.items.filter((i) => !off.has(i.key)).map((i) => i.key);
  const onApply = async () => {
    setBusy(true);
    try {
      await apply(chosen);
      showToast(chosen.length ? 'Plan updated' : 'Plan kept as it was');
    } catch {
      showToast('Could not update the plan. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card tone="warning">
      <Text variant="title" accessibilityRole="header">
        Adjust your plan?
      </Text>
      <Text variant="small" color="textSecondary">
        You logged {suggestion.session.title}, which wasn&apos;t in your plan. Nothing changes until
        you tap Apply.
      </Text>
      <View style={styles.items}>
        {suggestion.items.map((i) => (
          <Toggle
            key={i.key}
            label={
              i.kind === 'skip'
                ? `${dayLabel(i.date, today)}: mark ${i.fromTitle} as done by ${suggestion.session.title}`
                : `${dayLabel(i.date, today)}: ${i.fromTitle} → ${i.toTitle}`
            }
            description={i.reason}
            value={!off.has(i.key)}
            onChange={(on) =>
              setOff((prev) => {
                const next = new Set(prev);
                if (on) next.delete(i.key);
                else next.add(i.key);
                return next;
              })
            }
          />
        ))}
      </View>
      <Button
        title={chosen.length === suggestion.items.length ? 'Apply' : `Apply ${chosen.length}`}
        loading={busy}
        disabled={!chosen.length}
        onPress={() => void onApply()}
      />
      <Button title="Keep my plan" variant="ghost" disabled={busy} onPress={decline} />
    </Card>
  );
}

const styles = StyleSheet.create({ items: { gap: spacing.xs } });

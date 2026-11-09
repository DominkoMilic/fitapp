import { type Href, router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button, Card, SectionHeader, Text } from '@/components/ui';
import type { Recommendation } from '@/domain/coach/rules';
import { spacing, TOUCH_TARGET } from '@/theme';

import { useCoach } from './useCoach';

function CoachCard({ card, onDismiss }: { card: Recommendation; onDismiss: () => void }) {
  const [why, setWhy] = useState(false);
  const tone = card.category === 'safety' ? 'warning' : 'accent';
  return (
    <Card raised>
      <Text variant="small" color={tone}>
        {card.title}
      </Text>
      <Text>{card.body}</Text>
      {why ? (
        <Text variant="small" color="textSecondary">
          {card.reason}
        </Text>
      ) : null}
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: why }}
          onPress={() => setWhy((w) => !w)}
          hitSlop={8}
          style={styles.link}
        >
          <Text variant="small" color="accent">
            {why ? 'Hide reason' : 'Why am I seeing this?'}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Dismiss ${card.title} for today`}
          onPress={onDismiss}
          hitSlop={8}
          style={styles.link}
        >
          <Text variant="small" color="textSecondary">
            Dismiss
          </Text>
        </Pressable>
      </View>
      {card.action ? (
        <Button
          title={card.action.label}
          variant="secondary"
          onPress={() => router.push(card.action!.href as Href)}
        />
      ) : null}
    </Card>
  );
}

/** Today's top coach cards (spec 15.1). Renders nothing until data has loaded or when empty. */
export function CoachCards() {
  const { cards, isPending, dismiss } = useCoach();
  if (isPending || !cards.length) return null;
  return (
    <View style={styles.list}>
      <SectionHeader title="Coach" />
      {cards.map((c) => (
        <CoachCard key={c.id} card={c} onDismiss={() => dismiss(c.ruleId)} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  // 44 pt tall tap areas (Fitts / WCAG 2.5.8) for the small text links.
  link: { minHeight: TOUCH_TARGET, justifyContent: 'center' },
});

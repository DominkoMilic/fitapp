import { type Href, router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { X } from 'lucide-react-native';

import { Button, Card, SectionHeader, SwipeToDismiss, Text } from '@/components/ui';
import type { Recommendation } from '@/domain/coach/rules';
import { radius, spacing, TOUCH_TARGET, useTheme } from '@/theme';

import { useCoach } from './useCoach';

function CoachCard({ card, onDismiss }: { card: Recommendation; onDismiss: () => void }) {
  const { colors } = useTheme();
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
          style={({ pressed }) => [
            styles.dismiss,
            { borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <X size={14} color={colors.textSecondary} />
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
  const header = <SectionHeader title="Coach" />;
  const last = cards.length === 1;
  return (
    <View style={styles.list}>
      {/* With one card left, the header collapses together with it when it's dismissed. */}
      {last ? null : header}
      {cards.map((c) => (
        <SwipeToDismiss
          key={c.id}
          gap={spacing.sm}
          above={last ? header : undefined}
          onDismiss={() => dismiss(c.ruleId)}
        >
          {(animateOut) => <CoachCard card={c} onDismiss={animateOut} />}
        </SwipeToDismiss>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  // 44 pt tall tap areas (Fitts / WCAG 2.5.8) for the small text links.
  link: { minHeight: TOUCH_TARGET, justifyContent: 'center' },
  dismiss: {
    minHeight: TOUCH_TARGET - 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.pill,
    alignSelf: 'center',
  },
});

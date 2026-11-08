import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button, Screen, Text } from '@/components/ui';
import { spacing } from '@/theme';

export default function Welcome() {
  return (
    <Screen
      footer={
        <>
          <Button title="Create account" onPress={() => router.push('/sign-up')} />
          <Button
            title="I already have an account"
            variant="ghost"
            onPress={() => router.push('/sign-in')}
          />
        </>
      }
    >
      <View style={styles.hero}>
        <Text variant="hero" color="accent" accessibilityRole="header">
          PACE
        </Text>
        <Text variant="heading">Your personal fitness coach</Text>
        <Text variant="body" color="textSecondary">
          Realistic targets, a weekly plan built around your schedule and injuries, and clear daily
          guidance.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({ hero: { flex: 1, justifyContent: 'center', gap: spacing.sm } });

import { Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { palette } from '@/theme/tokens';

/**
 * Shown when a screen crashes (expo-router root ErrorBoundary). Self-contained: it may render
 * outside the theme and data providers. Never shows the error text (it can contain internals or
 * user data); the user can retry or go home.
 */
export function AppErrorBoundary({ retry }: { error: Error; retry: () => Promise<void> }) {
  const c = palette[useColorScheme() === 'light' ? 'light' : 'dark'];
  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: c.background }]}>
      <View style={styles.body} accessibilityRole="alert">
        <Text style={[styles.title, { color: c.textPrimary }]} accessibilityRole="header">
          Something went wrong
        </Text>
        <Text style={[styles.text, { color: c.textSecondary }]}>
          PACE hit an unexpected problem on this screen. Your saved data is safe. Changes that
          haven&apos;t synced yet are kept on this phone.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => void retry()}
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: c.accent, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Text style={[styles.buttonText, { color: c.onAccent }]}>Try again</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { flex: 1, justifyContent: 'center', padding: 24, gap: 16 },
  title: { fontSize: 22, fontWeight: '700' },
  text: { fontSize: 16, lineHeight: 22 },
  button: { minHeight: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: 16, fontWeight: '600' },
});

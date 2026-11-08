import { StyleSheet, Text, View } from 'react-native';

import { envResult } from '@/config/env';

/** Temporary root screen: replaced by the auth/onboarding gate in feature/p1-auth. */
export default function Index() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>PACE</Text>
      <Text style={styles.body}>
        {envResult.ok
          ? `Environment: ${envResult.env.appEnv}`
          : `Configuration error:\n${envResult.errors.join('\n')}`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#121417',
  },
  title: { color: '#34D399', fontSize: 34, fontWeight: '700' },
  body: { color: '#A3AAB5', marginTop: 12, textAlign: 'center', paddingHorizontal: 24 },
});

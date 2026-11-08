import { Banner } from '@/components/feedback/Banner';
import { Screen, Text } from '@/components/ui';
import { envResult } from '@/config/env';

/** Shown when required environment variables are missing. Never pretends the app works. */
export function ConfigErrorScreen() {
  const errors = envResult.ok ? [] : envResult.errors;
  return (
    <Screen>
      <Text variant="heading" accessibilityRole="header">
        PACE isn&apos;t configured
      </Text>
      <Banner
        tone="danger"
        title="Missing configuration"
        message={`${errors.join('\n')}\n\nCopy .env.example to .env.local, fill in your Supabase URL and anon key, then restart the dev server.`}
      />
    </Screen>
  );
}

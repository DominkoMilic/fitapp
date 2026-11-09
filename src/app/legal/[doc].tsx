import { Stack, useLocalSearchParams } from 'expo-router';

import { ErrorState } from '@/components/feedback';
import { Card, Screen, Text } from '@/components/ui';
import { LEGAL_DOCS, type LegalDocId } from '@/features/legal/documents';
import { useTheme } from '@/theme';

export default function LegalDocument() {
  const { doc } = useLocalSearchParams<{ doc: string }>();
  const { colors } = useTheme();
  const content = doc && Object.hasOwn(LEGAL_DOCS, doc) ? LEGAL_DOCS[doc as LegalDocId] : null;
  return (
    <Screen edges={['bottom']}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: content?.title ?? 'Not found',
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.textPrimary,
        }}
      />
      {content ? (
        content.sections.map((s) => (
          <Card key={s.heading}>
            <Text variant="bodyStrong" accessibilityRole="header">
              {s.heading}
            </Text>
            <Text variant="body" color="textSecondary">
              {s.body}
            </Text>
          </Card>
        ))
      ) : (
        <ErrorState title="Document not found" message="This document does not exist." />
      )}
    </Screen>
  );
}

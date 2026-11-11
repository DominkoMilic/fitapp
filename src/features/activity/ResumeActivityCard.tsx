import { router } from 'expo-router';

import { Button, Card, StatusTag, Text } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';

import { ACTIVITY_LABEL } from './labels';
import { useActiveRecording } from './recording-store';

/** Shown while an activity is being recorded, including after the app was closed (spec 11.6). */
export function ResumeActivityCard() {
  const r = useActiveRecording(useAuth().session?.user.id);
  if (!r) return null;
  return (
    <Card tone="warning">
      <StatusTag label={r.status === 'paused' ? 'Paused' : 'Recording'} tone="warning" />
      <Text variant="title">{ACTIVITY_LABEL[r.type]}</Text>
      <Button title="Open recording" onPress={() => router.push('/activity/track')} />
    </Card>
  );
}

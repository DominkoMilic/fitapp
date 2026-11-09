import { router } from 'expo-router';

import { Button, Card, Text } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';

import { ACTIVITY_LABEL } from './labels';
import { useActiveRecording } from './recording-store';

/** Shown while an activity is being recorded, including after the app was closed (spec 11.6). */
export function ResumeActivityCard() {
  const r = useActiveRecording(useAuth().session?.user.id);
  if (!r) return null;
  return (
    <Card raised>
      <Text variant="small" color="accent">
        {r.status === 'paused' ? 'Activity paused' : 'Recording in progress'}
      </Text>
      <Text variant="title">{ACTIVITY_LABEL[r.type]}</Text>
      <Button title="Open recording" onPress={() => router.push('/activity/track')} />
    </Card>
  );
}

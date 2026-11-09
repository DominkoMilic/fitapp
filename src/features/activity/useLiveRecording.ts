import { useEffect, useState } from 'react';

import type { RawPoint } from '@/domain/activity/gps-filter';
import { type Recording, withPoints } from '@/domain/activity/recording';
import { pointBuffer } from '@/services/location/point-buffer';

import { asRecording, type RecordingMeta } from './recording-store';

/** Reads stored points every `intervalMs` and rebuilds the track (the buffer is the source of truth). */
export function useLiveRecording(meta: RecordingMeta | null, intervalMs = 2000) {
  const [points, setPoints] = useState<RawPoint[]>([]);
  const id = meta?.id;
  useEffect(() => {
    if (!id) return;
    let alive = true;
    const load = () =>
      pointBuffer.all(id).then(
        (p) => alive && setPoints(p),
        () => undefined,
      );
    void load();
    const t = setInterval(load, intervalMs);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [id, intervalMs]);
  const recording: Recording | null = meta ? withPoints(asRecording(meta), points) : null;
  return { recording, points };
}

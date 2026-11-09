import type { RawPoint } from '@/domain/activity/gps-filter';

/** Durable store for raw GPS points of the activity being recorded (spec 11.3, 11.6). */
export interface PointBuffer {
  append(activityId: string, points: readonly RawPoint[]): Promise<void>;
  all(activityId: string): Promise<RawPoint[]>;
  clear(activityId: string): Promise<void>;
}

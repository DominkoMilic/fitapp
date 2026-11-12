import { router, type Href } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { addDays, instantFromLocal } from '@/domain/calculations/dates';
import { planNotifications } from '@/domain/notifications/planner';
import { minuteInTimezone } from '@/features/coach/time';
import { useToday } from '@/features/dashboard/useToday';
import { usePreferences, useProfile } from '@/features/profile/api';
import { useScheduledWorkouts } from '@/features/training/schedule-api';
import { useNow } from '@/hooks/useNow';
import { notifier } from '@/services/notifications/notifier';
import type { PermissionState } from '@/services/notifications/notifier.types';

import { readPrefs } from './prefs';

/**
 * Keeps scheduled reminders in line with the plan (spec 17): on start, when the schedule,
 * preferences, timezone or day change, and when the app returns to the foreground.
 */
export function useNotificationEngine() {
  const { today, timezone } = useToday();
  const now = useNow(15 * 60_000);
  const profile = useProfile();
  const prefs = usePreferences();
  const schedule = useScheduledWorkouts(addDays(today, -120), addDays(today, 120));
  const [permission, setPermission] = useState<PermissionState>('undetermined');
  /** Android exact-alarm access: when it changes, everything is rescheduled (exact vs inexact). */
  const [exact, setExact] = useState<PermissionState>('unsupported');
  const [foregroundTick, setForegroundTick] = useState(0);
  const lastSignature = useRef<string | null>(null);

  useEffect(() => notifier.onTap((href) => router.push(href as Href)), []);

  useEffect(() => {
    const check = () => {
      void notifier.permission().then(setPermission, () => undefined);
      void notifier.exactAlarm().then(setExact, () => undefined);
    };
    check();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') {
        check();
        setForegroundTick((t) => t + 1);
      }
    });
    return () => sub.remove();
  }, []);

  const reminders = useMemo(() => {
    if (!prefs.isSuccess || !schedule.isSuccess || !profile.isSuccess) return null;
    const plan = planNotifications({
      prefs: readPrefs(prefs.data?.notification_preferences),
      today,
      nowMinute: minuteInTimezone(new Date(now), timezone),
      weekStartsOn: profile.data?.week_start === 7 ? 7 : 1,
      events: schedule.rows.map((r) => ({
        id: r.id,
        date: r.scheduled_date,
        time: r.scheduled_time ? r.scheduled_time.slice(0, 5) : null,
        title: r.title,
        category: r.category,
        status: r.status,
      })),
    });
    return plan.map((n) => ({
      id: n.id,
      at: instantFromLocal(n.date, n.minute, timezone),
      title: n.title,
      body: n.body,
      href: n.href,
    }));
  }, [
    prefs.isSuccess,
    prefs.data,
    schedule.isSuccess,
    schedule.rows,
    profile.isSuccess,
    profile.data,
    today,
    now,
    timezone,
  ]);

  useEffect(() => {
    if (!reminders || permission !== 'granted') return;
    const signature = `${foregroundTick}|${exact}|${reminders.map((r) => `${r.id}@${r.at}`).join(',')}`;
    if (signature === lastSignature.current) return;
    lastSignature.current = signature;
    void notifier.reconcile(reminders).catch(() => {
      lastSignature.current = null; // try again next time
    });
  }, [reminders, permission, exact, foregroundTick]);
}

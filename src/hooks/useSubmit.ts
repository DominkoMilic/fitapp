import { useCallback, useRef, useState } from 'react';

import { useToast } from '@/components/feedback/Toast';
import { haptics } from '@/theme/haptics';

export const SAVE_FAILED = "Couldn't save. Check your connection and try again.";

/**
 * Runs a save once at a time (audit fix: double taps submitted twice, and failures were
 * unhandled). Shows a toast if it fails; nothing typed is lost because the screen stays open.
 */
export function useSubmit<A extends unknown[]>(
  fn: (...args: A) => Promise<unknown> | unknown,
  errorMessage: string = SAVE_FAILED,
) {
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  const showToast = useToast((s) => s.show);
  const run = useCallback(
    async (...args: A) => {
      if (running.current) return;
      running.current = true;
      setBusy(true);
      try {
        await fn(...args);
        haptics.success();
      } catch {
        showToast(errorMessage);
      } finally {
        running.current = false;
        setBusy(false);
      }
    },
    [fn, errorMessage, showToast],
  );
  return { run, busy };
}

/** For one-tap actions (skip, restore, tick): run in the background, tell the user if it fails. */
export function useGuardedAction(errorMessage = "That didn't work. Try again.") {
  const showToast = useToast((s) => s.show);
  return useCallback(
    (p: Promise<unknown>) => {
      p.catch(() => showToast(errorMessage));
    },
    [errorMessage, showToast],
  );
}

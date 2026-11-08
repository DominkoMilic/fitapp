import NetInfo from '@react-native-community/netinfo';
import { useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from 'react';
import { AppState } from 'react-native';

import { type NewOp, type OutboxOp, queueSummary, type SyncEntity } from '@/domain/sync/outbox';
import { useAuth } from '@/features/auth/AuthProvider';
import { supabase } from '@/integrations/supabase/client';
import { outboxStorage } from '@/services/sync/outbox-storage';
import { supabaseTransport } from '@/services/sync/supabase-transport';
import { SyncEngine } from '@/services/sync/sync-engine';

export const syncKeys = {
  entity: (userId: string, entity: SyncEntity) => ['sync-data', userId, entity] as const,
};

const SyncContext = createContext<SyncEngine | null>(null);
const FLUSH_INTERVAL_MS = 60_000;
const FLUSH_DEBOUNCE_MS = 1_000;

export function SyncProvider({ children }: PropsWithChildren) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const userId = session?.user.id ?? null;

  const engine = useMemo(() => {
    if (!userId) return null;
    return new SyncEngine({
      userId,
      storage: outboxStorage,
      transport: supabaseTransport,
      refreshAuth: async () => {
        if (!supabase) return false;
        const { error } = await supabase.auth.refreshSession();
        return !error;
      },
      onSynced: (entities) => {
        for (const e of entities)
          void queryClient.invalidateQueries({ queryKey: syncKeys.entity(userId, e) });
      },
    });
  }, [userId, queryClient]);

  useEffect(() => {
    if (!engine) return;
    void engine.flush();
    const interval = setInterval(() => {
      if (AppState.currentState === 'active') void engine.flush();
    }, FLUSH_INTERVAL_MS);
    const appState = AppState.addEventListener('change', (s) => {
      if (s === 'active') void engine.flush();
    });
    const net = NetInfo.addEventListener((s) => {
      if (s.isConnected) void engine.flush();
    });
    return () => {
      clearInterval(interval);
      appState.remove();
      net();
    };
  }, [engine]);

  return <SyncContext.Provider value={engine}>{children}</SyncContext.Provider>;
}

const EMPTY: readonly OutboxOp[] = [];
const noop = () => () => undefined;

/** The current user's outbox queue (re-renders on change). */
export function useOutbox(): readonly OutboxOp[] {
  const engine = useContext(SyncContext);
  return useSyncExternalStore(
    engine?.subscribe ?? noop,
    engine?.getSnapshot ?? (() => EMPTY),
    () => EMPTY,
  );
}

export function useSyncStatus() {
  const queue = useOutbox();
  const engine = useContext(SyncContext);
  return { ...queueSummary(queue), syncing: engine?.syncing ?? false };
}

/** Queue a write; it is shown immediately and synced in the background. */
export function useSyncActions() {
  const engine = useContext(SyncContext);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  return useMemo(
    () => ({
      write: async (op: Omit<NewOp, 'userId'>) => {
        if (!engine) throw new Error('Not signed in');
        await engine.enqueue(op);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => void engine.flush(), FLUSH_DEBOUNCE_MS);
      },
      flush: () => engine?.flush() ?? Promise.resolve(),
      retry: async (opId: string) => {
        await engine?.retry(opId);
        await engine?.flush();
      },
      discard: (opId: string) => engine?.discard(opId) ?? Promise.resolve(),
      clearLocal: () => engine?.clear() ?? Promise.resolve(),
    }),
    [engine],
  );
}

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { onlineManager, QueryClient } from '@tanstack/react-query';
import type { PersistQueryClientOptions } from '@tanstack/react-query-persist-client';

/** How long saved reads are kept on the phone for opening the app offline (spec 18.2). */
export const CACHE_MAX_AGE_MS = 3 * 24 * 60 * 60_000;

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      // gcTime must outlive the persisted cache, or restored data is dropped straight away.
      queries: {
        staleTime: 60_000,
        gcTime: CACHE_MAX_AGE_MS,
        retry: 2,
        refetchOnWindowFocus: false,
      },
      mutations: { retry: 0 },
    },
  });
}

/**
 * Reads are saved on the phone (app-private storage) so PACE opens with your data while offline
 * instead of waiting for the network. Only successful reads are kept, searches aren't, and
 * sign-out clears it (AuthProvider). Bump `buster` when cached shapes change.
 */
export const persistOptions: Omit<PersistQueryClientOptions, 'queryClient'> = {
  persister: createAsyncStoragePersister({
    storage: AsyncStorage,
    key: 'pace.query-cache',
    throttleTime: 2_000,
  }),
  maxAge: CACHE_MAX_AGE_MS,
  buster: 'v1',
  dehydrateOptions: {
    shouldDehydrateQuery: (q) =>
      q.state.status === 'success' && !(q.queryKey as unknown[]).includes('search'),
  },
};

let connected = false;
/**
 * Tells React Query when the phone is offline, so queries pause and resume on reconnect instead
 * of retrying and failing (audit fix). Idempotent.
 */
export function connectQueryOnlineState() {
  if (connected) return;
  connected = true;
  onlineManager.setEventListener((setOnline) =>
    NetInfo.addEventListener((s) => setOnline(s.isConnected !== false)),
  );
}

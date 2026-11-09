import NetInfo from '@react-native-community/netinfo';
import { onlineManager, QueryClient } from '@tanstack/react-query';

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 60_000, retry: 2, refetchOnWindowFocus: false },
      mutations: { retry: 0 },
    },
  });
}

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

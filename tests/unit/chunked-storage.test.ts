import { isSafeExternalUrl } from '@/navigation/external-link';
import {
  CHUNK_SIZE,
  createChunkedStorage,
  type KeyValueStore,
  safeKey,
} from '@/integrations/supabase/chunked-storage';

const memory = (): KeyValueStore & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return {
    data,
    getItem: async (k) => data.get(k) ?? null,
    setItem: async (k, v) => void data.set(k, v),
    removeItem: async (k) => void data.delete(k),
  };
};

describe('session storage in the keychain (chunked)', () => {
  const KEY = 'sb-abc-auth-token';
  it('round-trips values larger than one chunk', async () => {
    const secure = memory();
    const s = createChunkedStorage(secure);
    const value = 'x'.repeat(CHUNK_SIZE * 2 + 17);
    await s.setItem(KEY, value);
    expect(await s.getItem(KEY)).toBe(value);
    expect(secure.data.get(`${KEY}.n`)).toBe('3');
    expect([...secure.data.values()].every((v) => v.length <= CHUNK_SIZE)).toBe(true);
  });
  it('a shorter value removes the stale chunks', async () => {
    const secure = memory();
    const s = createChunkedStorage(secure);
    await s.setItem(KEY, 'y'.repeat(CHUNK_SIZE * 3));
    await s.setItem(KEY, 'short');
    expect(await s.getItem(KEY)).toBe('short');
    expect(secure.data.has(`${KEY}.1`)).toBe(false);
  });
  it('moves an existing plain session over once and deletes it there', async () => {
    const secure = memory();
    const legacy = memory();
    legacy.data.set(KEY, '{"access_token":"t"}');
    const s = createChunkedStorage(secure, legacy);
    expect(await s.getItem(KEY)).toBe('{"access_token":"t"}');
    expect(legacy.data.has(KEY)).toBe(false);
    expect(await s.getItem(KEY)).toBe('{"access_token":"t"}');
  });
  it('remove clears everything; missing or incomplete values read as signed out', async () => {
    const secure = memory();
    const s = createChunkedStorage(secure);
    expect(await s.getItem(KEY)).toBeNull();
    await s.setItem(KEY, 'z'.repeat(CHUNK_SIZE + 1));
    secure.data.delete(`${KEY}.1`);
    expect(await s.getItem(KEY)).toBeNull();
    await s.removeItem(KEY);
    expect(secure.data.size).toBe(0);
  });
  it('keys are made keychain-safe', () => {
    expect(safeKey('sb-x:auth/token')).toBe('sb-x_auth_token');
  });
});

describe('external links (audit: only https leaves the app)', () => {
  it('allows https only', () => {
    expect(isSafeExternalUrl('https://www.themealdb.com/meal/1')).toBe(true);
    for (const bad of [
      'javascript:alert(1)',
      'data:text/html,x',
      'file:///etc/passwd',
      'http://x.com',
      'intent://x',
      '',
      null,
      'not a url',
    ])
      expect(isSafeExternalUrl(bad)).toBe(false);
  });
});

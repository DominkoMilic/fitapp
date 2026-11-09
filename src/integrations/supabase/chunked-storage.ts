/**
 * Supabase session storage on top of a small key/value store (the iOS Keychain / Android Keystore
 * via expo-secure-store limits values to ~2 KB; a session is larger). Values are split into chunks
 * `<key>.0..n-1` with the count in `<key>.n`. On first read, a session left in the old plain storage
 * is moved over and deleted there. Pure: the stores are injected (tested in tests/unit).
 */
export interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export const CHUNK_SIZE = 1800;

/** SecureStore keys may only contain letters, digits, '.', '-' and '_'. */
export const safeKey = (key: string) => key.replace(/[^A-Za-z0-9._-]/g, '_');

export function createChunkedStorage(secure: KeyValueStore, legacy?: KeyValueStore): KeyValueStore {
  const countKey = (key: string) => `${safeKey(key)}.n`;
  const chunkKey = (key: string, i: number) => `${safeKey(key)}.${i}`;

  async function remove(key: string) {
    const n = Number((await secure.getItem(countKey(key))) ?? 0);
    for (let i = 0; i < n; i++) await secure.removeItem(chunkKey(key, i));
    await secure.removeItem(countKey(key));
  }

  async function set(key: string, value: string) {
    const old = Number((await secure.getItem(countKey(key))) ?? 0);
    const chunks = Math.max(1, Math.ceil(value.length / CHUNK_SIZE));
    for (let i = 0; i < chunks; i++) {
      await secure.setItem(chunkKey(key, i), value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE));
    }
    await secure.setItem(countKey(key), String(chunks));
    for (let i = chunks; i < old; i++) await secure.removeItem(chunkKey(key, i));
  }

  return {
    async getItem(key) {
      const n = await secure.getItem(countKey(key));
      if (n === null) {
        // One-time move from the old plain storage.
        const old = legacy ? await legacy.getItem(key) : null;
        if (old !== null && legacy) {
          await set(key, old);
          await legacy.removeItem(key);
        }
        return old;
      }
      const parts: string[] = [];
      for (let i = 0; i < Number(n); i++) {
        const part = await secure.getItem(chunkKey(key, i));
        if (part === null) return null; // incomplete write: treat as signed out
        parts.push(part);
      }
      return parts.join('');
    },
    setItem: set,
    async removeItem(key) {
      await remove(key);
      if (legacy) await legacy.removeItem(key);
    },
  };
}

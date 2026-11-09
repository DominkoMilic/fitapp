import {
  deleteAccount,
  type DeletionPorts,
  recentlyAuthenticated,
} from '@/domain/account/delete-account';

const UID = 'aaaaaaaa-0000-0000-0000-0000000000aa';

function fakeStorage(
  files: string[],
  opts: { failRemoveOnce?: boolean; userExists?: boolean } = {},
) {
  const store = new Set(files);
  let failed = false;
  let userExists = opts.userExists ?? true;
  const calls = { deleteUser: 0 };
  const ports: DeletionPorts = {
    listFolder: async (_b, folder, limit) =>
      [...store].filter((f) => f.startsWith(`${folder}/`)).slice(0, limit),
    removeObjects: async (_b, paths) => {
      if (opts.failRemoveOnce && !failed) {
        failed = true;
        throw new Error('storage unavailable');
      }
      for (const p of paths) store.delete(p);
    },
    deleteUser: async () => {
      calls.deleteUser++;
      if (!userExists) return 'not_found';
      userExists = false;
      return 'deleted';
    },
  };
  return { ports, store, calls };
}

describe('account deletion (spec 19, 28.10 #6)', () => {
  it('removes every object in the user folder (paged), then the user', async () => {
    const files = [
      ...Array.from({ length: 250 }, (_, i) => `${UID}/${i}.json`),
      'bbbbbbbb-0000-0000-0000-0000000000bb/keep.json',
    ];
    const { ports, store, calls } = fakeStorage(files);
    expect(await deleteAccount(ports, UID)).toEqual({ objectsRemoved: 250, user: 'deleted' });
    expect([...store]).toEqual(['bbbbbbbb-0000-0000-0000-0000000000bb/keep.json']);
    expect(calls.deleteUser).toBe(1);
  });
  it('the user is never deleted while storage cleanup fails; a retry finishes (idempotent)', async () => {
    const { ports, store, calls } = fakeStorage([`${UID}/a.json`], { failRemoveOnce: true });
    await expect(deleteAccount(ports, UID)).rejects.toThrow('storage unavailable');
    expect(calls.deleteUser).toBe(0);
    expect(await deleteAccount(ports, UID)).toEqual({ objectsRemoved: 1, user: 'deleted' });
    expect(store.size).toBe(0);
  });
  it('an already-deleted user counts as success', async () => {
    const { ports } = fakeStorage([], { userExists: false });
    expect(await deleteAccount(ports, UID)).toEqual({ objectsRemoved: 0, user: 'not_found' });
  });
  it('refuses a malformed id and objects outside the folder', async () => {
    const { ports } = fakeStorage([]);
    await expect(deleteAccount(ports, '../etc')).rejects.toThrow('invalid user id');
    const bad: DeletionPorts = { ...ports, listFolder: async () => ['other/x.json'] };
    await expect(deleteAccount(bad, UID)).rejects.toThrow('outside the user folder');
  });
  it('requires the password within the last 10 minutes', () => {
    const now = Date.parse('2026-11-09T12:00:00Z');
    expect(recentlyAuthenticated('2026-11-09T11:55:00Z', now)).toBe(true);
    expect(recentlyAuthenticated('2026-11-09T11:49:00Z', now)).toBe(false);
    expect(recentlyAuthenticated(null, now)).toBe(false);
    expect(recentlyAuthenticated('nonsense', now)).toBe(false);
  });
});

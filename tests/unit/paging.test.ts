import { fetchAllPages } from '@/integrations/supabase/paging';

/** A fake table that, like PostgREST, never returns more than 1000 rows per request. */
const table = (n: number) => {
  const rows = Array.from({ length: n }, (_, i) => ({ id: i }));
  const calls: [number, number][] = [];
  const page = async (from: number, to: number) => {
    calls.push([from, to]);
    return { data: rows.slice(from, Math.min(to + 1, from + 1000)), error: null };
  };
  return { page, calls };
};

describe('reading past the 1000-row API cap (audit fix)', () => {
  it('reads all 2,500 rows in 3 pages', async () => {
    const t = table(2500);
    const rows = await fetchAllPages(t.page);
    expect(rows).toHaveLength(2500);
    expect(rows[2499]).toEqual({ id: 2499 });
    expect(t.calls).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ]);
  });
  it('an exact multiple ends with one empty page', async () => {
    const t = table(1000);
    expect(await fetchAllPages(t.page)).toHaveLength(1000);
    expect(t.calls).toHaveLength(2);
  });
  it('small and empty results take one request', async () => {
    const t = table(3);
    expect(await fetchAllPages(t.page)).toHaveLength(3);
    expect(t.calls).toHaveLength(1);
  });
  it('errors are thrown, and a ceiling stops runaway reads', async () => {
    await expect(
      fetchAllPages(async () => ({ data: null, error: new Error('boom') })),
    ).rejects.toThrow('boom');
    const t = table(10_000);
    expect(await fetchAllPages(t.page, { maxRows: 3000 })).toHaveLength(3000);
  });
});

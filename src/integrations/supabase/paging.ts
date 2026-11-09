/**
 * Reads every row of a query, page by page (audit fix). The API returns at most 1000 rows per
 * request (PostgREST max_rows), so a single `.limit(5000)` silently stopped at 1000 and milestones,
 * records, reviews and reports used partial data. Queries must have a stable order (add an `id`
 * tie-breaker) so pages don't skip or repeat rows.
 */
export const PAGE_SIZE = 1000;
/** Safety ceiling against runaway reads (≈ 50 requests). */
export const MAX_ROWS = 50_000;

type Page<T> = PromiseLike<{ data: T[] | null; error: unknown }>;

export async function fetchAllPages<T>(
  page: (from: number, to: number) => Page<T>,
  { pageSize = PAGE_SIZE, maxRows = MAX_ROWS }: { pageSize?: number; maxRows?: number } = {},
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; from < maxRows; from += pageSize) {
    const { data, error } = await page(from, from + pageSize - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }
  return rows;
}

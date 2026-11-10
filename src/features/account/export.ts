import {
  EXPORT_FORMAT_VERSION,
  EXPORT_PAGE,
  EXPORT_TABLES,
  orderColumns,
  ownerFilter,
} from '@/domain/account/export-tables';
import { requireSupabase } from '@/integrations/supabase/client';
import { fetchAllPages } from '@/integrations/supabase/paging';

export interface ExportProgress {
  done: number;
  total: number;
  label: string;
}

/**
 * All of the user's data as JSON (spec 19): every table, read page by page, plus route files.
 * Runs on the device with the user's own session, so RLS guarantees it only contains their data.
 */
export async function buildExport(
  user: { id: string; email: string | null },
  onProgress: (p: ExportProgress) => void,
): Promise<string> {
  const db = requireSupabase();
  const tables: Record<string, unknown[]> = {};
  const total = EXPORT_TABLES.length + 1;
  let done = 0;
  for (const [table, ownerColumn] of EXPORT_TABLES) {
    onProgress({ done, total, label: table.replace(/_/g, ' ') });
    try {
      tables[table] = await fetchAllPages<unknown>(
        (from, to) => {
          const base = db.from(table).select('*');
          const or = ownerFilter(ownerColumn, user.id);
          // The table list is a union, so the column type can't be narrowed per table.
          let q = or ? base.or(or) : base.eq(ownerColumn as never, user.id as never);
          for (const col of orderColumns(table)) q = q.order(col as never);
          return q.range(from, to);
        },
        { pageSize: EXPORT_PAGE },
      );
    } catch (e) {
      throw new Error(`${table}: ${e instanceof Error ? e.message : 'read failed'}`);
    }
    done++;
  }

  onProgress({ done, total, label: 'routes' });
  const routes: Record<string, unknown> = {};
  for (const a of (tables.activities ?? []) as {
    id: string;
    route_storage_path: string | null;
  }[]) {
    if (!a.route_storage_path) continue;
    const { data, error } = await db.storage.from('routes').download(a.route_storage_path);
    if (error) continue; // a missing file doesn't stop the export; the activity row is still there
    try {
      routes[a.id] = JSON.parse(await data.text());
    } catch {
      routes[a.id] = null;
    }
  }
  onProgress({ done: total, total, label: 'done' });

  return JSON.stringify(
    {
      format: 'pace-export',
      version: EXPORT_FORMAT_VERSION,
      exported_at: new Date().toISOString(),
      user,
      units: 'metric (kg, cm, m, kcal, ml); times in UTC with local_date fields',
      tables,
      routes,
    },
    null,
    1,
  );
}

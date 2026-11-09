import { EXPORT_FORMAT_VERSION, EXPORT_PAGE, EXPORT_TABLES } from '@/domain/account/export-tables';
import { requireSupabase } from '@/integrations/supabase/client';

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
    const rows: unknown[] = [];
    for (let from = 0; ; from += EXPORT_PAGE) {
      const { data, error } = await db
        .from(table)
        .select('*')
        // The table list is a union, so the column type can't be narrowed per table.
        .eq(ownerColumn as never, user.id as never)
        .range(from, from + EXPORT_PAGE - 1);
      if (error) throw new Error(`${table}: ${error.message}`);
      rows.push(...(data ?? []));
      if (!data || data.length < EXPORT_PAGE) break;
    }
    tables[table] = rows;
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

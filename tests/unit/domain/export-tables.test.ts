import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { EXPORT_ORDER_KEY, EXPORT_TABLES, NOT_EXPORTED } from '@/domain/account/export-tables';

/** Tables in the generated types whose Row has a user_id or owner_id column. */
function userTablesFromTypes(): string[] {
  const src = readFileSync(
    join(__dirname, '../../../src/integrations/supabase/database.types.ts'),
    'utf8',
  );
  const tables = src.slice(src.indexOf('Tables: {'), src.indexOf('Views: {'));
  const out: string[] = [];
  for (const m of tables.matchAll(/\n {6}([a-z_]+): \{\n {8}Row: \{([\s\S]*?)\n {8}\};/g)) {
    if (/\n {10}(user_id|owner_id)\??: /.test(m[2]!)) out.push(m[1]!);
  }
  return out;
}

describe('data export covers every user table (spec 27 #18)', () => {
  it('lists every table with a user_id/owner_id column, plus profiles', () => {
    const found = userTablesFromTypes();
    expect(found.length).toBeGreaterThan(25);
    const listed = new Set<string>(EXPORT_TABLES.map(([t]) => t));
    const missing = found.filter(
      (t) => !listed.has(t) && !(NOT_EXPORTED as readonly string[]).includes(t),
    );
    expect(missing).toEqual([]);
    expect(listed.has('profiles')).toBe(true);
  });
  it('has no duplicates', () => {
    const names = EXPORT_TABLES.map(([t]) => t);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe('export paging order', () => {
  it('every table without an id column has a unique sort key', () => {
    const src = readFileSync(
      join(__dirname, '../../../src/integrations/supabase/database.types.ts'),
      'utf8',
    );
    const tables = src.slice(src.indexOf('Tables: {'), src.indexOf('Views: {'));
    const noId: string[] = [];
    for (const m of tables.matchAll(/\n {6}([a-z_]+): \{\n {8}Row: \{([\s\S]*?)\n {8}\};/g))
      if (!/\n {10}id: /.test(m[2]!)) noId.push(m[1]!);
    const exported = new Set<string>(EXPORT_TABLES.map(([t]) => t));
    for (const t of noId.filter((x) => exported.has(x)))
      expect(EXPORT_ORDER_KEY[t as keyof typeof EXPORT_ORDER_KEY]).toBeTruthy();
  });
});

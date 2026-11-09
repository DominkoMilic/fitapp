import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { MIN_AGE_YEARS, MIN_TARGET_BMI, SEX_FLOOR_KCAL } from '@/constants/safety';

/** The database enforces the same safety numbers as the app (audit fix: server-side safety). */
describe('server-side safety rules match src/constants/safety.ts', () => {
  const sql = readFileSync(
    join(__dirname, '../../supabase/migrations/20261114000100_server_side_safety.sql'),
    'utf8',
  );
  it('sex floor', () => {
    expect(sql).toContain(
      `when 'female' then ${SEX_FLOOR_KCAL.female} else ${SEX_FLOOR_KCAL.male}`,
    );
  });
  it('minimum age and target BMI', () => {
    expect(sql).toContain(`interval '${MIN_AGE_YEARS} years'`);
    expect(sql.match(new RegExp(`< ${MIN_TARGET_BMI}\\b`, 'g'))?.length).toBe(2);
  });
});

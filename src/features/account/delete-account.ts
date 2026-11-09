import { FunctionsHttpError } from '@supabase/supabase-js';

import { requireSupabase } from '@/integrations/supabase/client';

export type DeleteError =
  'wrong_password' | 'reauthentication_required' | 'network' | 'retry' | 'unknown';

/** Calls the delete-account function (after the password was re-entered). Retry-safe. */
export async function requestAccountDeletion(): Promise<
  { ok: true } | { ok: false; error: DeleteError }
> {
  try {
    const { error } = await requireSupabase().functions.invoke('delete-account', {
      body: { confirm: 'DELETE' },
    });
    if (!error) return { ok: true };
    if (error instanceof FunctionsHttpError) {
      const status = error.context.status as number;
      if (status === 403) return { ok: false, error: 'reauthentication_required' };
      return { ok: false, error: status >= 500 ? 'retry' : 'unknown' };
    }
    return { ok: false, error: 'network' };
  } catch {
    return { ok: false, error: 'network' };
  }
}

export { clearLocalData } from './local-data';

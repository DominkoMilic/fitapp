// delete-account: permanent in-app account deletion (spec 19, App Store requirement).
// - Requires a signed-in user who re-entered their password in the last 10 minutes.
// - Body must be { "confirm": "DELETE" }.
// - Deletes Storage objects under <user id>/ in every user bucket, then the auth user; every table
//   cascades from auth.users. Idempotent: a retry after a partial failure finishes the job.
// - Logs never include user data.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { z } from 'npm:zod@4';

import { deleteAccount, recentlyAuthenticated } from '../_shared/delete-account.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
const env = (name: string) => Deno.env.get(name) ?? '';
const requestSchema = z.object({ confirm: z.literal('DELETE') });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const url = env('SUPABASE_URL');
  const userClient = createClient(url, env('SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const { data: auth, error: authError } = await userClient.auth.getUser();
  if (authError || !auth.user) return json({ error: 'unauthorized' }, 401);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }
  if (!requestSchema.safeParse(body).success) return json({ error: 'confirmation_required' }, 400);
  if (!recentlyAuthenticated(auth.user.last_sign_in_at, Date.now()))
    return json({ error: 'reauthentication_required' }, 403);

  const admin = createClient(url, env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false },
  });
  const { data: allowed, error: rlError } = await admin.rpc('hit_rate_limit', {
    uid: auth.user.id,
    bucket_name: 'delete-account',
    max_hits: 5,
    window_seconds: 60,
  });
  // Fail closed: if the limiter can't answer, don't run a destructive operation.
  if (rlError) return json({ error: 'rate_limit_unavailable', retry: true }, 503);
  if (!allowed) return json({ error: 'rate_limited' }, 429);

  try {
    const result = await deleteAccount(
      {
        async listFolder(bucket, folder, limit) {
          const { data, error } = await admin.storage.from(bucket).list(folder, { limit });
          if (error) throw error;
          return (data ?? []).map((o) => `${folder}/${o.name}`);
        },
        async removeObjects(bucket, paths) {
          const { error } = await admin.storage.from(bucket).remove(paths);
          if (error) throw error;
        },
        async deleteUser(userId) {
          const { error } = await admin.auth.admin.deleteUser(userId);
          if (!error) return 'deleted';
          if (error.status === 404 || /not.?found/i.test(error.message)) return 'not_found';
          throw error;
        },
      },
      auth.user.id,
    );
    return json({ deleted: true, objectsRemoved: result.objectsRemoved });
  } catch (e) {
    console.error('delete-account failed:', e instanceof Error ? e.name : 'error');
    return json({ error: 'deletion_failed', retry: true }, 502);
  }
});

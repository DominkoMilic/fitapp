// recipes-proxy: the only path from the app to TheMealDB (spec 12.3, 22.2).
// - Requires a signed-in user; 60 requests per minute per user.
// - The TheMealDB key is a server secret (THEMEALDB_API_KEY); "1" is TheMealDB's public test key.
// - Responses are validated and normalised with the same code the app tests (_shared/).
// - Full recipes are cached in public.recipes for 24 h (service role; users cannot write them).
// - External recipes never carry nutrition (the database refuses it too).
import { createClient } from 'npm:@supabase/supabase-js@2';
import { z } from 'npm:zod@4';

import {
  normalizeMeal,
  normalizeMealList,
  normalizeSummary,
} from '../_shared/recipe-normalizer.ts';
import type { NormalizedRecipe } from '../_shared/recipe-provider.interface.ts';
import {
  IMAGE_BUCKET,
  IMAGE_REF_PREFIX,
  mirrorImages,
  type MirrorPorts,
} from '../_shared/image-mirror.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const CACHE_HOURS = 24;
const RATE_LIMIT_PER_MINUTE = 60;

const text = z.string().trim().min(1).max(80);
const requestSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('search'), query: text }),
  z.object({ action: z.literal('categories') }),
  z.object({ action: z.literal('byCategory'), category: text }),
  z.object({ action: z.literal('byIngredient'), ingredient: text }),
  z.object({ action: z.literal('lookup'), externalId: z.string().regex(/^\d{1,10}$/) }),
  z.object({ action: z.literal('random') }),
]);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

const env = (name: string) => Deno.env.get(name) ?? '';

async function mealdb(path: string): Promise<unknown> {
  const key = env('THEMEALDB_API_KEY') || '1';
  const res = await fetch(
    `https://www.themealdb.com/api/json/v1/${encodeURIComponent(key)}/${path}`,
    {
      headers: { 'User-Agent': 'PACE-recipes-proxy/1.0' },
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!res.ok) throw new Error(`TheMealDB responded ${res.status}`);
  return res.json();
}

function toRow(r: NormalizedRecipe) {
  return {
    source: 'themealdb',
    external_id: r.externalId,
    owner_id: null,
    name: r.name,
    category: r.category,
    cuisine: r.cuisine,
    tags: r.tags,
    image_url: r.imageUrl,
    instructions: r.instructions,
    ingredients: r.ingredients.map((i) => ({
      name: i.name,
      raw_measure: i.measure.raw,
      quantity_min: i.measure.quantityMin,
      quantity_max: i.measure.quantityMax,
      unit: i.measure.unit,
      note: i.measure.note,
      parse_status: i.measure.status,
    })),
    servings_stated: null,
    source_url: r.sourceUrl,
    video_url: r.videoUrl,
    nutritional_confidence: 'none',
    fetched_at: new Date().toISOString(),
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const url = env('SUPABASE_URL');
  const authHeader = req.headers.get('Authorization') ?? '';
  const userClient = createClient(url, env('SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: auth, error: authError } = await userClient.auth.getUser();
  if (authError || !auth.user) return json({ error: 'unauthorized' }, 401);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) return json({ error: 'invalid_request' }, 400);
  const input = parsed.data;

  const admin = createClient(url, env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false },
  });
  const { data: allowed, error: rlError } = await admin.rpc('hit_rate_limit', {
    uid: auth.user.id,
    bucket_name: 'recipes-proxy',
    max_hits: RATE_LIMIT_PER_MINUTE,
    window_seconds: 60,
  });
  if (rlError) return json({ error: 'rate_limit_unavailable' }, 503);
  if (!allowed) return json({ error: 'rate_limited' }, 429);

  // Photos are copied to PACE's Storage once; responses and stored rows only carry
  // 'storage:recipe-images/…' references, never TheMealDB URLs (privacy).
  const imagePorts: MirrorPorts = {
    async known(ids) {
      if (!ids.length) return new Set();
      const { data } = await admin
        .from('recipe_images')
        .select('external_id')
        .in('external_id', ids);
      return new Set((data ?? []).map((r: { external_id: string }) => r.external_id));
    },
    async fetchImage(url) {
      const res = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(8_000) });
      if (!res.ok) return null;
      const type = (res.headers.get('content-type') ?? '').split(';')[0]!.trim();
      if (Number(res.headers.get('content-length') ?? 0) > 1_000_000) return null;
      return { bytes: new Uint8Array(await res.arrayBuffer()), type };
    },
    async upload(path, bytes, type) {
      const { error } = await admin.storage
        .from(IMAGE_BUCKET)
        .upload(path, bytes, { contentType: type, upsert: true, cacheControl: '31536000' });
      if (error) throw error;
    },
    async remember(externalId, path) {
      await admin.from('recipe_images').upsert({ external_id: externalId, path });
    },
  };
  const withImages = async <T extends { externalId: string; imageUrl: string | null }>(
    items: T[],
  ) => {
    const refs = await mirrorImages(items, imagePorts);
    return items.map((i) => ({ ...i, imageUrl: refs.get(i.externalId) ?? null }));
  };

  const upsertRecipe = async (r: NormalizedRecipe) => {
    const [withRef] = await withImages([r]);
    const { data, error } = await admin
      .from('recipes')
      .upsert(toRow(withRef!), { onConflict: 'source,external_id' })
      .select()
      .single();
    if (error) throw error;
    return data;
  };

  try {
    switch (input.action) {
      case 'search': {
        const list = normalizeMealList(
          await mealdb(`search.php?s=${encodeURIComponent(input.query)}`),
          normalizeSummary,
        );
        return json({ items: await withImages(list.items), dropped: list.dropped });
      }
      case 'categories': {
        const body = (await mealdb('list.php?c=list')) as {
          meals?: { strCategory?: unknown }[] | null;
        };
        const items = (body.meals ?? [])
          .map((m) => m.strCategory)
          .filter((c): c is string => typeof c === 'string');
        return json({ items });
      }
      case 'byCategory':
      case 'byIngredient': {
        const q =
          input.action === 'byCategory'
            ? `c=${encodeURIComponent(input.category)}`
            : `i=${encodeURIComponent(input.ingredient)}`;
        const list = normalizeMealList(await mealdb(`filter.php?${q}`), normalizeSummary);
        return json({ items: await withImages(list.items), dropped: list.dropped });
      }
      case 'lookup': {
        const { data: cached } = await admin
          .from('recipes')
          .select('*')
          .eq('source', 'themealdb')
          .eq('external_id', input.externalId)
          .maybeSingle();
        const hasPaceImage =
          !!cached?.image_url && String(cached.image_url).startsWith(IMAGE_REF_PREFIX);
        if (
          cached?.fetched_at &&
          Date.now() - Date.parse(cached.fetched_at) < CACHE_HOURS * 3600_000 &&
          hasPaceImage
        ) {
          return json({ recipe: cached, cached: true });
        }
        const list = normalizeMealList(
          await mealdb(`lookup.php?i=${input.externalId}`),
          normalizeMeal,
        );
        const recipe = list.items[0];
        if (!recipe)
          return cached
            ? json({ recipe: cached, cached: true, stale: true })
            : json({ error: 'not_found' }, 404);
        return json({ recipe: await upsertRecipe(recipe), cached: false });
      }
      case 'random': {
        const list = normalizeMealList(await mealdb('random.php'), normalizeMeal);
        const recipe = list.items[0];
        return recipe
          ? json({ recipe: await upsertRecipe(recipe) })
          : json({ error: 'not_found' }, 404);
      }
    }
  } catch (e) {
    // No user data in logs: only the action and the error class.
    console.error('recipes-proxy', input.action, e instanceof Error ? e.message : 'error');
    return json({ error: 'upstream_unavailable' }, 502);
  }
});

import { envResult } from '@/config/env';

import { recipeImageUri } from './image-mirror';

/** Recipe photo URL on PACE's own Storage, or null (never a TheMealDB URL; audit: privacy). */
export const recipeImage = (ref: string | null | undefined) =>
  envResult.ok ? recipeImageUri(ref, envResult.env.supabaseUrl) : null;

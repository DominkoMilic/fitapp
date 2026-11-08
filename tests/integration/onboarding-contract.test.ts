/**
 * Client ↔ database contract: writes the payload the app builds for the seed user so
 * scripts/verify-migrations.sh can pass it to the real public.complete_onboarding().
 * Runs only when PACE_PAYLOAD_OUT is set (the verify script sets it).
 */
import { writeFileSync } from 'fs';

import { buildSeed } from '../fixtures/onboarding';

const out = process.env.PACE_PAYLOAD_OUT;
const maybe = out ? it : it.skip;

describe('onboarding payload contract', () => {
  maybe('writes the seed payload for the database contract test', () => {
    const { payload } = buildSeed();
    writeFileSync(out as string, JSON.stringify(payload));
    expect(payload.targets.kcal).toBe(2720);
  });
});

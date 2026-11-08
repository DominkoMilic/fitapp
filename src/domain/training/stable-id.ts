/**
 * Deterministic UUID (version-5 layout) from a string, so system exercises and templates have the
 * same id in the bundled app catalogue and in the database seed. Not cryptographic; inputs are
 * our own slugs. Pure and dependency-free (also used by scripts/gen-training-seed.mjs).
 */
export function stableUuid(name: string): string {
  const seeds = [0x811c9dc5, 0x01000193, 0x9e3779b9, 0x85ebca6b];
  const parts = seeds.map((seed) => {
    let h = seed >>> 0;
    for (let i = 0; i < name.length; i++) {
      h ^= name.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
      h = (h ^ (h >>> 13)) >>> 0;
    }
    return h.toString(16).padStart(8, '0');
  });
  const hex = parts.join('');
  const variant = ((parseInt(hex[16]!, 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export const exerciseId = (slug: string) => stableUuid(`pace:exercise:${slug}`);

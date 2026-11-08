import { EXERCISES, TEMPLATES } from '@/domain/training/catalogue';
import { exerciseId, stableUuid } from '@/domain/training/stable-id';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('stableUuid', () => {
  it('is deterministic and well-formed for every catalogue id', () => {
    const ids = [
      ...EXERCISES.map((e) => exerciseId(e.slug)),
      ...TEMPLATES.flatMap((t) => [
        stableUuid(`pace:template:${t.slug}`),
        ...t.exercises.map((_, i) => stableUuid(`pace:template:${t.slug}:${i}`)),
      ]),
    ];
    for (const id of ids) expect(id).toMatch(UUID);
    expect(new Set(ids).size).toBe(ids.length);
    expect(exerciseId('push-up')).toBe(exerciseId('push-up'));
  });
  it('handles many inputs without negative or malformed output', () => {
    for (let i = 0; i < 5000; i++) expect(stableUuid(`x${i}-${'é'.repeat(i % 7)}`)).toMatch(UUID);
  });
});

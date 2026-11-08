import {
  EXERCISE_BY_SLUG,
  EXERCISES,
  TEMPLATE_BY_SLUG,
  TEMPLATES,
} from '@/domain/training/catalogue';
import { AREA_RESTRICTIONS, restrictionTagsFor } from '@/domain/training/injury';
import { EQUIPMENT_TYPES } from '@/domain/validation/onboarding';

const ALL_TAGS = new Set(Object.values(AREA_RESTRICTIONS).flat().concat(['grip_heavy']));
const EQUIPMENT = new Set<string>(EQUIPMENT_TYPES);

describe('exercise catalogue integrity (spec 25.2)', () => {
  it('has unique slugs and complete content', () => {
    expect(new Set(EXERCISES.map((e) => e.slug)).size).toBe(EXERCISES.length);
    for (const e of EXERCISES) {
      expect(e.instructions.length).toBeGreaterThanOrEqual(2);
      expect(e.caution.length).toBeGreaterThan(5);
      if (e.tracking === 'time') expect(e.durationS).not.toBeNull();
      else expect(e.repsMin).not.toBeNull();
    }
  });
  it('uses only known contraindication tags and equipment', () => {
    for (const e of EXERCISES) {
      for (const t of e.contraindications) expect(ALL_TAGS.has(t as never)).toBe(true);
      for (const req of e.equipment)
        for (const opt of req.split('|')) expect(EQUIPMENT.has(opt)).toBe(true);
    }
  });
});

describe('workout templates (spec 25.3)', () => {
  it('reference existing exercises and alternatives', () => {
    for (const t of TEMPLATES) {
      for (const x of t.exercises) {
        expect(EXERCISE_BY_SLUG[x.slug]).toBeDefined();
        if (x.alternative) expect(EXERCISE_BY_SLUG[x.alternative]).toBeDefined();
      }
      if (t.shortVersion) expect(TEMPLATE_BY_SLUG[t.shortVersion]).toBeDefined();
    }
  });
  it('includes every template the weekly plan generator can choose', () => {
    for (const slug of [
      'strength-a-upper',
      'strength-b-lower',
      'strength-b-ankle-safe',
      'full-body-45',
      'full-body-20',
      'low-impact-conditioning',
      'recovery',
    ]) {
      expect(TEMPLATE_BY_SLUG[slug]).toBeDefined();
    }
  });
  it('the ankle-safe template contains nothing restricted for a recovering ankle', () => {
    const restricted = restrictionTagsFor({ bodyArea: 'ankle_foot', status: 'recovering' });
    for (const x of TEMPLATE_BY_SLUG['strength-b-ankle-safe']!.exercises) {
      const tags = EXERCISE_BY_SLUG[x.slug]!.contraindications;
      expect(tags.filter((t) => restricted.includes(t as never))).toEqual([]);
    }
  });
  it('strength templates include a warm-up', () => {
    for (const t of TEMPLATES.filter((x) => x.category === 'strength')) {
      expect(t.exercises.some((x) => x.phase === 'warmup')).toBe(true);
    }
  });
});

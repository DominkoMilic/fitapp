import { SPORTS, SPORT_KEYS } from '@/domain/sports/catalogue';
import {
  EXERCISE_BY_SLUG,
  EXERCISES,
  TEMPLATE_BY_SLUG,
  TEMPLATES,
} from '@/domain/training/catalogue';
import { restrictionTagsFor } from '@/domain/training/injury';
import { generateWeeklyPattern } from '@/domain/training/weekly-pattern';
import { buildWorkout } from '@/domain/training/workout-builder';

const packs = [...new Set(SPORTS.map((s) => s.drillPack))];
const build = (slug: string, owned: string[], restrictions: string[] = []) =>
  buildWorkout({
    template: TEMPLATE_BY_SLUG[slug]!,
    exercisesBySlug: EXERCISE_BY_SLUG,
    restrictions: restrictions as never,
    ownedEquipment: new Set(owned),
  });

describe('per-sport drill packs', () => {
  it('every sport has a sport-skills pack', () => {
    for (const s of SPORTS) {
      expect(TEMPLATE_BY_SLUG[s.drillPack]?.category).toBe('sport_skills');
    }
    expect(packs.length).toBeGreaterThanOrEqual(11);
  });

  it('drills name only known sports, and every sport has its own drills', () => {
    for (const e of EXERCISES) for (const k of e.sports ?? []) expect(SPORT_KEYS).toContain(k);
    for (const k of SPORT_KEYS.filter((k) => k !== 'cycling'))
      expect(EXERCISES.some((e) => e.sports?.includes(k))).toBe(true);
  });

  it('template sets match how each exercise is tracked', () => {
    for (const t of TEMPLATES)
      for (const x of t.exercises) {
        const e = EXERCISE_BY_SLUG[x.slug]!;
        if (e.tracking === 'time') expect([t.slug, x.slug, x.durationS]).not.toContain(null);
        else expect([t.slug, x.slug, x.repsMin]).not.toContain(null);
      }
  });

  it('every pack still works for someone with no equipment', () => {
    for (const slug of packs) {
      const main = build(slug, []).exercises.filter((x) => x.phase === 'main');
      expect([slug, main.length >= 2]).toEqual([slug, true]);
    }
  });

  it('an active ankle injury removes every jumping, sprinting and cutting drill', () => {
    const tags = restrictionTagsFor({ bodyArea: 'ankle_foot', status: 'active' });
    const all = ['ball', 'racket', 'stick', 'resistance_bands', 'cones'];
    for (const slug of packs) {
      for (const x of build(slug, all, tags).exercises) {
        const bad = EXERCISE_BY_SLUG[x.slug]!.contraindications.filter((t: string) =>
          tags.includes(t as never),
        );
        expect([slug, x.slug, bad]).toEqual([slug, x.slug, []]);
      }
    }
  });

  it('legacy "football" ball still satisfies ball drills', () => {
    const main = build('basketball-skills', ['football']).exercises.map((x) => x.slug);
    expect(main).toContain('stationary-dribble-series');
  });
});

describe('weekly sport-skills session', () => {
  const base = {
    trainingDaysPerWeek: 3,
    preferredDays: [1, 3, 5],
    maxSessionMinutes: 45,
    commitments: [],
    focusTags: ['sport', 'strength'],
    injuries: [],
  };
  const skills = (p: ReturnType<typeof generateWeeklyPattern>) =>
    p.days.filter((d) => d.kind === 'sport_skills');

  it('adds one session from the first sport’s pack', () => {
    const s = skills(generateWeeklyPattern({ ...base, sports: ['basketball', 'tennis'] }));
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({
      title: 'Basketball skills',
      templateSlug: 'basketball-skills',
      minutes: 30,
    });
  });

  it('none without a sport, with fewer than 3 days, or without the sport focus', () => {
    expect(skills(generateWeeklyPattern({ ...base, sports: [] }))).toHaveLength(0);
    expect(
      skills(generateWeeklyPattern({ ...base, trainingDaysPerWeek: 2, sports: ['handball'] })),
    ).toHaveLength(0);
    expect(
      skills(generateWeeklyPattern({ ...base, focusTags: ['strength'], sports: ['handball'] })),
    ).toHaveLength(0);
  });

  it('none while the injury is not cleared for that sport', () => {
    const injuries = [{ bodyArea: 'ankle_foot' as const, status: 'recovering' as const }];
    expect(
      skills(generateWeeklyPattern({ ...base, injuries, sports: ['basketball'] })),
    ).toHaveLength(0);
  });
});

describe('training science pass (spec 25.3)', () => {
  const sportPacks = TEMPLATES.filter((t) => t.category === 'sport_skills');
  it('every sport pack starts with the dynamic warm-up', () => {
    for (const t of sportPacks) {
      const warm = t.exercises.filter((x) => x.phase === 'warmup').map((x) => x.slug);
      expect([t.slug, warm[0]]).toEqual([t.slug, 'march-in-place']);
      expect(warm).toContain('leg-swings');
      if (!['swim-skills', 'cycle-skills'].includes(t.slug))
        expect(warm).toContain('build-up-runs');
    }
  });
  it('sprint and change-of-direction work gets at least 90 s rest', () => {
    for (const t of sportPacks)
      for (const x of t.exercises) {
        const e = EXERCISE_BY_SLUG[x.slug]!;
        if (x.phase === 'main' && e.tracking !== 'time' && e.contraindications.includes('sprint'))
          expect([t.slug, x.slug, x.restS >= 90]).toEqual([t.slug, x.slug, true]);
      }
  });
  it('jumping volume stays at or under 30 contacts per pack', () => {
    for (const t of sportPacks) {
      const contacts = t.exercises
        .filter((x) => x.phase === 'main')
        .map((x) => ({ x, e: EXERCISE_BY_SLUG[x.slug]! }))
        .filter(({ e }) => e.tracking !== 'time' && e.contraindications.includes('jumping'))
        .reduce((n, { x, e }) => n + x.sets * (x.repsMax ?? 0) * (e.unilateral ? 2 : 1), 0);
      expect([t.slug, contacts <= 30]).toEqual([t.slug, true]);
    }
  });
  it('the sport session avoids two days before a game when another day is free', () => {
    const p = generateWeeklyPattern({
      trainingDaysPerWeek: 3,
      preferredDays: [1, 3, 4],
      maxSessionMinutes: 45,
      commitments: [
        {
          title: 'League',
          category: 'basketball_match',
          weekday: 6,
          localTime: '18:00',
          durationMinutes: 60,
          intensity: 'hard',
        },
      ],
      focusTags: ['sport'],
      injuries: [],
      sports: ['basketball'],
    });
    const sport = p.days.find((d) => d.kind === 'sport_skills');
    expect(sport).toBeDefined();
    expect(sport!.weekday).not.toBe(4); // Thursday = two days before Saturday's game
  });
});

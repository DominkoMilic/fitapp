import { evaluateCoach, type CoachContext, type PlanItem } from '@/domain/coach/rules';
import { categoryLabel } from '@/domain/format';
import { DEFAULT_PREFS, planNotifications } from '@/domain/notifications/planner';
import {
  eventNoun,
  isValidCommitmentCategory,
  parseSportCategory,
  SPORT_BY_KEY,
  SPORTS,
  sportCategory,
  sportEventLabel,
  sportMet,
} from '@/domain/sports/catalogue';
import { sportRestricted, sportRestrictedFor } from '@/domain/training/injury';
import { sessionMet } from '@/domain/training/session';
import { type Commitment, generateWeeklyPattern } from '@/domain/training/weekly-pattern';
import { commitmentSchema } from '@/domain/validation/onboarding';

describe('sports catalogue (all-sport support)', () => {
  it('has the broad list with unique keys and sane values', () => {
    expect(SPORTS.length).toBeGreaterThanOrEqual(16);
    const keys = SPORTS.map((s) => s.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const s of SPORTS) {
      expect(s.key).toMatch(/^[a-z_]{2,30}$/);
      expect(s.met.match).toBeGreaterThan(2);
      expect(s.met.match).toBeLessThanOrEqual(12);
      expect(s.met.practice).toBeLessThanOrEqual(s.met.match);
      expect(s.loadAreas.length).toBeGreaterThan(0);
    }
    for (const k of [
      'football',
      'futsal',
      'basketball',
      'handball',
      'volleyball',
      'tennis',
      'padel',
      'badminton',
      'table_tennis',
      'hockey',
      'rugby',
      'water_polo',
      'martial_arts',
      'swimming',
      'running',
      'cycling',
      'other',
    ])
      expect(SPORT_BY_KEY[k]).toBeDefined();
  });
  it('categories round-trip, including keys with underscores', () => {
    expect(sportCategory('table_tennis', 'match')).toBe('table_tennis_match');
    expect(parseSportCategory('table_tennis_match')).toMatchObject({
      sport: { key: 'table_tennis' },
      type: 'match',
    });
    expect(parseSportCategory('futsal_practice')).toMatchObject({
      sport: { key: 'futsal' },
      type: 'practice',
    });
    expect(parseSportCategory('curling_match')).toBeNull();
    expect(parseSportCategory('strength')).toBeNull();
  });
  it('labels use each sport’s own words', () => {
    expect(sportEventLabel('basketball_match')).toBe('Basketball game');
    expect(sportEventLabel('martial_arts_practice')).toBe('Martial arts / boxing class');
    expect(sportEventLabel('swimming_match')).toBe('Swimming (club) race');
    expect(eventNoun('hockey_match')).toBe('game');
    expect(categoryLabel('tennis_practice')).toBe('Tennis practice');
    expect(categoryLabel('strength')).toBe('Strength');
  });
  it('calories use the sport’s MET; legacy football values are unchanged', () => {
    expect(sessionMet({ category: 'futsal_match', intensity: 'hard' })).toBe(10.0);
    expect(sessionMet({ category: 'football_practice', intensity: 'hard' })).toBe(7.0);
    expect(sessionMet({ category: 'basketball_match', intensity: 'hard' })).toBe(8.0);
    expect(sessionMet({ category: 'table_tennis_match', intensity: 'hard' })).toBe(4.0);
    expect(sportMet('strength')).toBeNull();
  });
  it('valid commitment categories: any known sport event or an activity', () => {
    for (const ok of [
      'basketball_match',
      'tennis_practice',
      'run',
      'walk',
      'cycle',
      'workout',
      'other',
    ])
      expect(isValidCommitmentCategory(ok)).toBe(true);
    for (const bad of ['basketball_final', 'curling_match', 'DROP TABLE', ''])
      expect(isValidCommitmentCategory(bad)).toBe(false);
    const base = {
      title: 'x',
      weekday: 6,
      localTime: '18:00',
      durationMinutes: 60,
      intensity: 'hard' as const,
    };
    expect(commitmentSchema.safeParse({ ...base, category: 'handball_match' }).success).toBe(true);
    expect(commitmentSchema.safeParse({ ...base, category: 'handball_final' }).success).toBe(false);
  });
});

describe('injury rules per sport', () => {
  const ankle = [{ bodyArea: 'ankle_foot' as const, status: 'recovering' as const }];
  const shoulder = [{ bodyArea: 'shoulder' as const, status: 'active' as const }];
  it('a sprained ankle stops basketball but not swimming', () => {
    expect(sportRestrictedFor(ankle, 'basketball')).toBe(true);
    expect(sportRestrictedFor(ankle, 'swimming')).toBe(false);
  });
  it('a shoulder injury stops tennis and swimming but not running', () => {
    expect(sportRestrictedFor(shoulder, 'tennis')).toBe(true);
    expect(sportRestrictedFor(shoulder, 'swimming')).toBe(true);
    expect(sportRestrictedFor(shoulder, 'running')).toBe(false);
  });
  it('unknown sports count every area; cleared_sport clears it', () => {
    expect(sportRestrictedFor(shoulder, 'unknown')).toBe(true);
    expect(sportRestrictedFor([{ bodyArea: 'shoulder', status: 'cleared_sport' }], 'tennis')).toBe(
      false,
    );
  });
  it('without sports, the original football rule (lower body) applies', () => {
    expect(sportRestricted(ankle)).toBe(true);
    expect(sportRestricted(shoulder)).toBe(false);
    expect(sportRestricted(shoulder, ['tennis', 'running'])).toBe(true);
  });
});

describe('scheduling, coach and reminders work for any sport', () => {
  const game: Commitment = {
    title: 'League game',
    category: 'basketball_match',
    weekday: 6,
    localTime: '18:00',
    durationMinutes: 90,
    intensity: 'hard',
  };
  it('basketball games get the day-before rest and day-after recovery', () => {
    const p = generateWeeklyPattern({
      trainingDaysPerWeek: 3,
      preferredDays: [],
      maxSessionMinutes: 45,
      commitments: [game],
      focusTags: ['sport'],
      injuries: [],
    });
    expect(p.days.find((d) => d.weekday === 5)?.kind).toBe('rest');
    expect(p.days.find((d) => d.weekday === 5)?.notes.join(' ')).toMatch(/Day before your game/);
    expect(p.days.find((d) => d.weekday === 7)?.notes.join(' ')).toMatch(/Day after your game/);
  });
  it('a swimmer with a recovering ankle gets no sport warning', () => {
    const swim: Commitment = { ...game, category: 'swimming_practice', title: 'Club training' };
    const p = generateWeeklyPattern({
      trainingDaysPerWeek: 3,
      preferredDays: [],
      maxSessionMinutes: 45,
      commitments: [swim],
      focusTags: [],
      injuries: [{ bodyArea: 'ankle_foot', status: 'recovering' }],
    });
    expect(p.warnings).not.toContain('sport_while_injured');
  });
  it('no-sport users get a plain week with no sport notes', () => {
    const p = generateWeeklyPattern({
      trainingDaysPerWeek: 3,
      preferredDays: [],
      maxSessionMinutes: 45,
      commitments: [],
      focusTags: [],
      injuries: [],
    });
    expect(p.days.flatMap((d) => d.notes).join(' ')).not.toMatch(/match|game|sport/i);
  });
  it('coach and reminder copy name the sport', () => {
    const item = (category: string): PlanItem => ({
      id: 'g',
      title: 'League game',
      category,
      intensity: 'hard',
      time: '18:00',
      status: 'planned',
      adjustedFor: [],
    });
    const ctx: CoachContext = {
      today: '2026-11-13',
      minuteOfDay: 600,
      injuries: [],
      plan: { yesterday: [], today: [], tomorrow: [item('basketball_match')] },
      sessions: [],
      checkin: null,
      weightGoalActive: false,
      lastWeighIn: null,
      week: { planned: 0, completed: 0 },
      dataDays: 30,
      dismissed: new Set(),
    };
    const r1 = evaluateCoach(ctx).find((c) => c.ruleId === 'R1');
    expect(r1?.title).toBe('Basketball game tomorrow');
    const out = planNotifications({
      prefs: DEFAULT_PREFS,
      today: '2026-11-13',
      nowMinute: 0,
      weekStartsOn: 1,
      events: [
        {
          id: 'g',
          date: '2026-11-14',
          time: '18:00',
          title: 'League game',
          category: 'handball_match',
          status: 'planned',
        },
      ],
    });
    expect(out.find((n) => n.kind === 'match')?.title).toBe('Handball match tomorrow');
  });
});

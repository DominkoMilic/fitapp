import { type Commitment, generateWeeklyPattern } from '@/domain/training/weekly-pattern';

const practice: Commitment = {
  title: 'Futsal practice match',
  category: 'futsal_practice',
  weekday: 2,
  localTime: '20:00',
  durationMinutes: 60,
  intensity: 'hard',
};
const match: Commitment = {
  title: 'Futsal league match',
  category: 'futsal_match',
  weekday: 6,
  localTime: '18:00',
  durationMinutes: 60,
  intensity: 'hard',
};

const kinds = (p: ReturnType<typeof generateWeeklyPattern>) => p.days.map((d) => d.kind);

describe('weekly pattern', () => {
  it('reproduces the seed week from spec 25.1 (ankle recovering)', () => {
    const p = generateWeeklyPattern({
      trainingDaysPerWeek: 2,
      preferredDays: [1, 4],
      maxSessionMinutes: 45,
      commitments: [practice, match],
      focusTags: ['futsal', 'strength'],
      injuries: [{ bodyArea: 'ankle_foot', status: 'recovering' }],
    });
    expect(kinds(p)).toEqual([
      'strength_upper', // Mon
      'commitment', // Tue practice
      'recovery', // Wed (after hard)
      'strength_lower_safe', // Thu (MD-2, ankle-safe)
      'rest', // Fri (MD-1)
      'commitment', // Sat match
      'recovery', // Sun (MD+1)
    ]);
    expect(p.warnings).toContain('sport_while_injured');
    expect(p.days[5]?.notes.join(' ')).toMatch(/professional/);
  });

  it('never schedules strength on MD-1 or MD+1', () => {
    for (let n = 0; n <= 7; n++) {
      const p = generateWeeklyPattern({
        trainingDaysPerWeek: n,
        preferredDays: [5, 7],
        maxSessionMinutes: 60,
        commitments: [match],
        focusTags: [],
        injuries: [],
      });
      expect(p.days[4]?.kind).toBe('rest'); // Fri = MD-1
      expect(p.days[6]?.kind).toBe('recovery'); // Sun = MD+1
    }
  });

  it('always has at least one full rest day', () => {
    const p = generateWeeklyPattern({
      trainingDaysPerWeek: 7,
      preferredDays: [],
      maxSessionMinutes: 60,
      commitments: [],
      focusTags: [],
      injuries: [],
    });
    expect(kinds(p)).toContain('rest');
    expect(p.warnings).toContain('fewer_sessions_than_requested');
  });

  it('uses 20-minute sessions when time is short', () => {
    const p = generateWeeklyPattern({
      trainingDaysPerWeek: 3,
      preferredDays: [1, 3, 5],
      maxSessionMinutes: 20,
      commitments: [],
      focusTags: [],
      injuries: [],
    });
    expect(p.days.filter((d) => d.kind === 'full_body_short')).toHaveLength(3);
  });

  it('replaces lower-body strength while a lower-body injury is active', () => {
    const p = generateWeeklyPattern({
      trainingDaysPerWeek: 2,
      preferredDays: [1, 4],
      maxSessionMinutes: 45,
      commitments: [],
      focusTags: [],
      injuries: [{ bodyArea: 'knee', status: 'active' }],
    });
    expect(kinds(p)).not.toContain('strength_lower');
    expect(kinds(p)).not.toContain('strength_lower_safe');
  });

  it('no training days → recovery and rest only', () => {
    const p = generateWeeklyPattern({
      trainingDaysPerWeek: 0,
      preferredDays: [],
      maxSessionMinutes: 45,
      commitments: [],
      focusTags: [],
      injuries: [],
    });
    expect(new Set(kinds(p))).toEqual(new Set(['rest', 'recovery']));
    expect(p.warnings).toContain('no_training_days');
  });

  it('flags more than 4 hard days', () => {
    const hard = [1, 2, 3, 4, 5].map((weekday) => ({ ...practice, weekday }));
    const p = generateWeeklyPattern({
      trainingDaysPerWeek: 0,
      preferredDays: [],
      maxSessionMinutes: 45,
      commitments: hard,
      focusTags: [],
      injuries: [],
    });
    expect(p.warnings).toContain('too_many_hard_days');
  });

  it('is deterministic', () => {
    const input = {
      trainingDaysPerWeek: 3,
      preferredDays: [1, 3, 5],
      maxSessionMinutes: 45,
      commitments: [practice, match],
      focusTags: ['cardio'],
      injuries: [],
    };
    expect(generateWeeklyPattern(input)).toEqual(generateWeeklyPattern(input));
  });
});

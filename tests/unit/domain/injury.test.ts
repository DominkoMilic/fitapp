import {
  activeRestrictions,
  isContraindicated,
  restrictionTagsFor,
  sportRestricted,
} from '@/domain/training/injury';

describe('injury restrictions', () => {
  it('active and recovering ankle exclude every ankle tag', () => {
    for (const status of ['active', 'recovering'] as const) {
      expect(restrictionTagsFor({ bodyArea: 'ankle_foot', status }).sort()).toEqual(
        ['ankle_load_high', 'impact', 'jumping', 'lateral', 'single_leg_balance', 'sprint'].sort(),
      );
    }
  });
  it('cleared_training keeps only sport tags', () => {
    expect(
      restrictionTagsFor({ bodyArea: 'ankle_foot', status: 'cleared_training' }).sort(),
    ).toEqual(['impact', 'jumping', 'lateral', 'sprint'].sort());
  });
  it('cleared_sport and resolved restrict nothing', () => {
    expect(restrictionTagsFor({ bodyArea: 'knee', status: 'cleared_sport' })).toEqual([]);
    expect(restrictionTagsFor({ bodyArea: 'knee', status: 'resolved' })).toEqual([]);
  });
  it('combines several injuries without duplicates', () => {
    const tags = activeRestrictions([
      { bodyArea: 'ankle_foot', status: 'recovering' },
      { bodyArea: 'knee', status: 'active' },
    ]);
    expect(new Set(tags).size).toBe(tags.length);
    expect(tags).toContain('deep_knee_flexion');
  });
  it('detects contraindicated exercises', () => {
    const r = restrictionTagsFor({ bodyArea: 'ankle_foot', status: 'recovering' });
    expect(isContraindicated(['impact', 'jumping'], r)).toBe(true);
    expect(isContraindicated([], r)).toBe(false);
    expect(isContraindicated(['overhead'], r)).toBe(false);
  });
  it('sport is restricted until cleared_sport for lower-body injuries', () => {
    expect(sportRestricted([{ bodyArea: 'ankle_foot', status: 'recovering' }])).toBe(true);
    expect(sportRestricted([{ bodyArea: 'ankle_foot', status: 'cleared_training' }])).toBe(true);
    expect(sportRestricted([{ bodyArea: 'ankle_foot', status: 'cleared_sport' }])).toBe(false);
    expect(sportRestricted([{ bodyArea: 'shoulder', status: 'active' }])).toBe(false);
  });
});

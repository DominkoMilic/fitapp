import {
  type LoggedSession,
  type PlanRow,
  readAdaptedNote,
  suggestAdaptations,
  swapFields,
  undoFields,
  visibleNotes,
} from '@/domain/training/adapt';

const TODAY = '2026-11-12';
const futsal: LoggedSession = {
  id: 's1',
  date: TODAY,
  category: 'futsal_practice',
  title: 'Futsal',
  minutes: 60,
  rpe: 8,
};
const row = (p: Partial<PlanRow>): PlanRow => ({
  id: 'r',
  date: TODAY,
  category: 'strength',
  kind: 'workout',
  status: 'planned',
  title: 'Strength B — Lower & core',
  templateSlug: 'strength-b-lower',
  intensity: 'moderate',
  minutes: 45,
  notes: [],
  ...p,
});
const run = row({
  id: 'run',
  date: '2026-11-13',
  category: 'run',
  kind: 'commitment',
  title: 'Run',
  templateSlug: null,
});
const suggest = (logged: LoggedSession[], plan: PlanRow[], handled: string[] = []) =>
  suggestAdaptations({ logged, plan, today: TODAY, handled: new Set(handled) });

describe('plan adaptation after an unplanned session', () => {
  it('futsal today: marks today’s workout replaced and swaps tomorrow’s run for upper-body strength', () => {
    const r = suggest([futsal], [row({ id: 'today' }), run])!;
    expect(r.session.id).toBe('s1');
    expect(r.items.map((i) => [i.kind, i.rowId, i.toTemplateSlug])).toEqual([
      ['skip', 'today', null],
      ['swap', 'run', 'strength-a-upper'],
    ]);
    expect(r.items[1]!.reason).toMatch(
      /Run works your legs and conditioning again right after Futsal/,
    );
  });

  it('an easy walk changes nothing', () => {
    expect(
      suggest([{ ...futsal, category: 'walk', title: 'Walk', rpe: 3, minutes: 30 }], [run]),
    ).toBeNull();
  });

  it('an easy short session only replaces today, it does not swap tomorrow', () => {
    const r = suggest([{ ...futsal, rpe: 4, minutes: 30 }], [row({ id: 'today' }), run])!;
    expect(r.items.map((i) => i.kind)).toEqual(['skip']);
  });

  it('when the session loaded everything, suggests recovery work instead of strength', () => {
    const rugby = { ...futsal, category: 'rugby_match', title: 'Rugby' };
    const r = suggest(
      [rugby],
      [row({ id: 'up', date: '2026-11-13', templateSlug: 'full-body-45', title: 'Full body' })],
    )!;
    expect(r.items[0]!.toTemplateSlug).toBe('mobility-15');
  });

  it('never a strength session the day before a game', () => {
    const match = row({
      id: 'm',
      date: '2026-11-14',
      category: 'futsal_match',
      kind: 'commitment',
      templateSlug: null,
      title: 'Futsal match',
    });
    const r = suggest([futsal], [run, match])!;
    expect(r.items[0]!.toTemplateSlug).toBe('mobility-15');
  });

  it('never changes games, team practices, or finished items', () => {
    const practice = row({
      id: 'p',
      date: '2026-11-13',
      category: 'futsal_practice',
      kind: 'commitment',
      templateSlug: null,
    });
    const done = { ...run, id: 'done', status: 'completed' };
    expect(suggest([futsal], [practice, done])).toBeNull();
  });

  it('nothing planned: no suggestion; declined suggestions stay declined', () => {
    expect(suggest([futsal], [])).toBeNull();
    expect(suggest([futsal], [run], ['s1:run:swap'])).toBeNull();
  });

  it('ignores old sessions', () => {
    expect(suggest([{ ...futsal, date: '2026-11-09' }], [run])).toBeNull();
  });

  it('a swap can be undone exactly, and its machine note is hidden', () => {
    const fields = swapFields(run, 'strength-a-upper', 'Futsal');
    expect(fields).toMatchObject({
      template_slug: 'strength-a-upper',
      category: 'strength',
      kind: 'workout',
      is_user_modified: true,
    });
    expect(visibleNotes(fields.notes)).toEqual(['Changed from Run after Futsal.']);
    expect(readAdaptedNote(fields.notes)?.after).toBe('Futsal');
    expect(undoFields({ notes: fields.notes })).toEqual({
      template_slug: null,
      title: 'Run',
      category: 'run',
      intensity: 'moderate',
      kind: 'commitment',
      estimated_duration_minutes: 45,
      notes: [],
    });
    expect(undoFields({ notes: ['Day before your match'] })).toBeNull();
  });
});

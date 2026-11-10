import { mergeHistory } from '@/domain/training/history';

const s = (id: string, started_at: string) => ({ id, started_at });

describe('mergeHistory', () => {
  it('interleaves workouts and activities newest first', () => {
    const out = mergeHistory(
      [s('w1', '2026-11-08T10:00:00Z'), s('w2', '2026-11-06T10:00:00Z')],
      [s('a1', '2026-11-07T07:00:00Z'), s('a2', '2026-11-09T18:00:00Z')],
    );
    expect(out.map((e) => e.id)).toEqual(['a2', 'w1', 'a1', 'w2']);
    expect(out.map((e) => e.kind)).toEqual(['activity', 'workout', 'activity', 'workout']);
  });

  it('compares instants, not strings, across time-zone offsets', () => {
    const out = mergeHistory(
      [s('w', '2026-11-08T10:00:00+02:00')], // 08:00Z
      [s('a', '2026-11-08T09:00:00Z')],
    );
    expect(out.map((e) => e.id)).toEqual(['a', 'w']);
  });

  it('puts workouts first on equal start times', () => {
    const t = '2026-11-08T10:00:00Z';
    expect(mergeHistory([s('w', t)], [s('a', t)]).map((e) => e.id)).toEqual(['w', 'a']);
  });

  it('handles empty inputs', () => {
    expect(mergeHistory([], [])).toEqual([]);
    expect(mergeHistory([], [s('a', '2026-11-08T10:00:00Z')])).toHaveLength(1);
  });
});

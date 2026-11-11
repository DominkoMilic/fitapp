import { dayMarks, defaultDay } from '@/domain/training/week-strip';

const item = (id: string, date: string, status = 'planned', kind = 'workout') => ({
  id,
  scheduled_date: date,
  status,
  kind,
});

describe('training week strip', () => {
  const MON = '2026-11-09';

  it('marks each day by its most telling item', () => {
    const marks = dayMarks(
      MON,
      [
        item('a', '2026-11-09', 'completed'),
        item('b', '2026-11-10'),
        item('c', '2026-11-10', 'completed'),
        item('d', '2026-11-11', 'skipped'),
        item('e', '2026-11-12', 'planned', 'rest'),
        item('f', '2026-11-13'),
        item('g', '2026-11-14', 'cancelled'),
      ],
      'f',
    );
    expect(marks.map((m) => m.mark)).toEqual([
      'done',
      'planned',
      'skipped',
      'rest',
      'progress',
      'none',
      'none',
    ]);
    expect(marks[1]!.count).toBe(2);
    expect(marks[3]!.count).toBe(0);
    expect(marks.map((m) => m.date)[6]).toBe('2026-11-15');
  });

  it('opens on today in this week, otherwise on the first day', () => {
    expect(defaultDay(MON, '2026-11-11')).toBe('2026-11-11');
    expect(defaultDay('2026-11-16', '2026-11-11')).toBe('2026-11-16');
  });
});

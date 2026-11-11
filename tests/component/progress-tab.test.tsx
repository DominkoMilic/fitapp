import { fireEvent, screen } from '@testing-library/react-native';

import Progress from '@/app/(tabs)/progress';

import { renderWithTheme } from '../setup/render';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a) } }));
jest.mock('@/components/charts/WeightChart', () => ({ WeightChart: () => null }));
jest.mock('@/features/milestones/GoalReachedCard', () => ({ GoalReachedCard: () => null }));
jest.mock('@/features/profile/api', () => ({
  useProfile: () => ({ data: { unit_system: 'metric' } }),
}));
jest.mock('@/features/weight/useWeightStats', () => ({
  useWeightStats: () => ({
    weights: { isPending: false, isError: false, entries: [{}], refetch: jest.fn() },
    goal: { isPending: false, data: { goal_type: 'lose_weight' } },
    daily: [
      { date: '2026-11-10', kg: 106.8 },
      { date: '2026-11-11', kg: 106.1 },
    ],
    inRange: [],
    rangeFrom: '2026-10-12',
    today: '2026-11-11',
    current: { kg: 106.5, date: '2026-11-11', basis: 'average' },
    startKg: 107,
    targetKg: 90,
    changeSinceStart: -0.5,
  }),
}));

beforeEach(() => jest.clearAllMocks());

describe('Progress tab', () => {
  it('logs weight from the + button and opens each section from its tile', async () => {
    await renderWithTheme(<Progress />);
    await fireEvent.press(screen.getByRole('button', { name: 'Log weight' }));
    expect(mockPush).toHaveBeenLastCalledWith('/weight/log');
    const routes: [string, string][] = [
      ['Weight history', '/progress/weight'],
      ['Measurements', '/progress/measurements'],
      ['Milestones', '/progress/milestones'],
      ['Weekly report', '/reports'],
    ];
    for (const [name, route] of routes) {
      await fireEvent.press(screen.getByRole('button', { name }));
      expect(mockPush).toHaveBeenLastCalledWith(route);
    }
  });

  it('shows the key figures in one card, with the latest weigh-in', async () => {
    await renderWithTheme(<Progress />);
    expect(screen.getByLabelText('Current weight: 106.1 kg')).toBeTruthy();
    expect(screen.getByLabelText('7-day average: 106.5 kg')).toBeTruthy();
    expect(screen.getByLabelText('Total change: -0.5 kg')).toBeTruthy();
    expect(screen.getByText(/· today/)).toBeTruthy();
  });
});

import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import SocialSettingsScreen from '@/app/settings/social';

import { renderWithTheme } from '../setup/render';

const mockUpdateSettings = jest.fn();
const mockHide = jest.fn();
const mockShow = jest.fn();
let mockHiddenCount = 0;

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() } }));
jest.mock('@/navigation/back', () => ({ goBack: jest.fn() }));
jest.mock('@/features/profile/features', () => ({
  useFeatures: () => ({ social: true, loaded: true }),
}));
const mutation = (fn = jest.fn()) => ({ mutate: fn, isPending: false, variables: undefined });
jest.mock('@/features/social/api', () => ({
  errorCode: () => 'unknown',
  useOnline: () => true,
  useMySocialProfile: () => ({
    data: {
      user_id: 'me',
      handle: 'dev.one',
      display_name: 'Dev',
      avatar_color: 'violet',
      bio: null,
      discoverable: true,
    },
    isPending: false,
    isError: false,
  }),
  useSocialSettings: () => ({
    data: {
      user_id: 'me',
      workouts_audience: 'friends',
      activities_audience: 'private',
      milestones_audience: 'private',
      challenge_results_audience: 'private',
      share_volume: false,
      friend_requests_from: 'everyone',
      in_leaderboards: false,
      notify_cheers: true,
      notify_comments: true,
      notify_requests: true,
      notify_flagged: true,
    },
    isPending: false,
    isError: false,
  }),
  useUpdateSocialProfile: () => mutation(),
  useUpdateSocialSettings: () => mutation(mockUpdateSettings),
  useSetSocialEnabled: () => mutation(),
  useDeleteSocialProfile: () => mutation(),
  useHideMyPosts: () => mutation(mockHide),
  useShowMyPosts: () => mutation(mockShow),
  hiddenPostCount: () => Promise.resolve(mockHiddenCount),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockHiddenCount = 0;
});

it('turning a type off stops sharing and offers to hide earlier posts', async () => {
  await renderWithTheme(<SocialSettingsScreen />);
  await fireEvent.press(screen.getByRole('switch', { name: 'Workouts' }));
  expect(mockUpdateSettings.mock.calls[0]![0]).toEqual({ workouts_audience: 'private' });
  expect(await screen.findByText('Hide your earlier workouts too?')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Hide them' }));
  expect(mockHide.mock.calls[0]![0]).toBe('workout');
});

it('keeping earlier posts is a choice', async () => {
  await renderWithTheme(<SocialSettingsScreen />);
  await fireEvent.press(screen.getByRole('switch', { name: 'Workouts' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Keep them' }));
  expect(mockHide).not.toHaveBeenCalled();
});

it('turning a type on offers to show the posts hidden that way', async () => {
  mockHiddenCount = 3;
  await renderWithTheme(<SocialSettingsScreen />);
  await act(async () => {
    fireEvent.press(screen.getByRole('switch', { name: 'Walks, runs and rides' }));
  });
  await waitFor(() =>
    expect(screen.getByText('Show your earlier walks, runs and rides again?')).toBeTruthy(),
  );
  expect(screen.getByText(/3 posts were hidden/)).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Show them' }));
  expect(mockShow.mock.calls[0]![0]).toBe('activity');
});

it('turning a type on asks nothing when nothing was hidden', async () => {
  await renderWithTheme(<SocialSettingsScreen />);
  await act(async () => {
    fireEvent.press(screen.getByRole('switch', { name: 'Milestones' }));
  });
  expect(screen.queryByText(/again\?/)).toBeNull();
});

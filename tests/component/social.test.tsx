import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import { FriendsSection } from '@/features/social/FriendsSection';
import SocialSetupScreen, { NEVER_SHARED } from '@/app/social/setup';
import SocialUser from '@/app/social/user/[handle]';
import type { FriendRow, PublicProfile, SocialSetup } from '@/features/social/api';

import { renderWithTheme } from '../setup/render';

const mockComplete = jest.fn();
const mockAccept = jest.fn();
const mockRemove = jest.fn();
const mockSend = jest.fn();
const mockReplace = jest.fn();
let mockOnline = true;
let mockAvailable = true;
let mockFriends: FriendRow[] = [];
let mockProfile: PublicProfile | null = null;
const ME = { user_id: 'me', handle: 'me.handle', display_name: 'Me', avatar_color: 'mint' };
let mockMe: typeof ME | null = ME;

const mutation = (fn: jest.Mock) => ({
  mutate: (...a: unknown[]) => fn(...a),
  isPending: false,
  isError: false,
  error: null,
  reset: jest.fn(),
});

jest.mock('expo-router', () => ({
  router: { replace: (...a: unknown[]) => mockReplace(...a), push: jest.fn(), back: jest.fn() },
  useLocalSearchParams: () => ({ handle: 'ana' }),
  Stack: { Screen: () => null },
}));
jest.mock('@/navigation/back', () => ({ goBack: jest.fn() }));
jest.mock('@/features/profile/api', () => ({
  useProfile: () => ({ data: { display_name: 'Ana Marić' } }),
}));
jest.mock('@/features/social/api', () => ({
  errorCode: () => 'unknown',
  isHandleAvailable: () => Promise.resolve(mockAvailable),
  useOnline: () => mockOnline,
  useMySocialProfile: () => ({
    data: mockMe,
    isPending: false,
    isError: false,
  }),
  useFriendships: () => ({ data: mockFriends, isPending: false, isError: false }),
  useSocialProfile: () => ({ data: mockProfile, isPending: false, isError: false }),
  useCompleteSocialSetup: () => mutation(mockComplete),
  useAcceptFriendRequest: () => mutation(mockAccept),
  useRemoveFriend: () => mutation(mockRemove),
  useSendFriendRequest: () => mutation(mockSend),
  useBlockUser: () => mutation(jest.fn()),
  useUnblockUser: () => mutation(jest.fn()),
  useReport: () => ({ ...mutation(jest.fn()), isSuccess: false }),
}));

const press = async (name: string | RegExp) =>
  fireEvent.press(screen.getByRole('button', { name }));

beforeEach(() => {
  jest.clearAllMocks();
  mockOnline = true;
  mockAvailable = true;
  mockFriends = [];
  mockProfile = null;
  mockMe = ME;
});

describe('social setup', () => {
  beforeEach(() => {
    mockMe = null;
  });

  it('suggests a handle, shares nothing by default, and records only what was chosen', async () => {
    await renderWithTheme(<SocialSetupScreen />);
    expect(screen.getByDisplayValue('ana.maric')).toBeTruthy();
    await press('Next');
    await screen.findByText('What friends see');

    const switches = screen.getAllByRole('switch');
    expect(switches.length).toBeGreaterThanOrEqual(4);
    for (const s of switches) expect(s.props.accessibilityState).toEqual({ checked: false });
    for (const line of NEVER_SHARED) expect(screen.getByText(`• ${line}`)).toBeTruthy();

    await fireEvent.press(screen.getByRole('switch', { name: 'Walks, runs and rides' }));
    await press('Next');
    expect(
      screen.getByRole('switch', { name: 'Appear in leaderboards' }).props.accessibilityState,
    ).toEqual({
      checked: false,
    });
    await press('Turn on social');

    const setup = mockComplete.mock.calls[0]![0] as SocialSetup;
    expect(setup.handle).toBe('ana.maric');
    expect(setup.settings).toEqual({
      workouts_audience: 'private',
      activities_audience: 'friends',
      milestones_audience: 'private',
      challenge_results_audience: 'private',
      share_volume: false,
      in_leaderboards: false,
      friend_requests_from: 'everyone',
    });
  });

  it('explains handle problems before going on', async () => {
    await renderWithTheme(<SocialSetupScreen />);
    await fireEvent.changeText(screen.getByLabelText(/^Handle/), 'admin');
    await press('Next');
    expect(screen.getByText('That handle is reserved. Try another.')).toBeTruthy();

    mockAvailable = false;
    await fireEvent.changeText(screen.getByLabelText(/^Handle/), 'taken_one');
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Next' }));
    });
    await waitFor(() =>
      expect(screen.getByText('That handle is taken. Try another.')).toBeTruthy(),
    );
    expect(screen.queryByText('What friends see')).toBeNull();
  });
});

describe('social tab', () => {
  const row = (handle: string, relationship: FriendRow['relationship']): FriendRow => ({
    user_id: `id-${handle}`,
    handle,
    display_name: handle.toUpperCase(),
    avatar_color: 'sky',
    relationship,
    since: '2026-11-17T10:00:00Z',
  });

  it('shows an empty state with ways to add friends', async () => {
    await renderWithTheme(<FriendsSection header={null} handle="me.handle" />);
    expect(screen.getByText('Train together')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add friends' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Invite' })).toBeTruthy();
  });

  it('lists requests first and accepts them', async () => {
    mockFriends = [row('bob', 'friends'), row('cat', 'incoming'), row('dan', 'outgoing')];
    await renderWithTheme(<FriendsSection header={null} handle="me.handle" />);
    expect(screen.getByText('Requests (1)')).toBeTruthy();
    expect(screen.getByText('Friends (1)')).toBeTruthy();
    expect(screen.getByText('Sent requests')).toBeTruthy();
    await press('Accept CAT');
    expect(mockAccept.mock.calls[0]![0]).toBe('id-cat');
    await press('Cancel request to DAN');
    expect(mockRemove.mock.calls[0]![0]).toBe('id-dan');
  });

  it('pauses changes offline', async () => {
    mockOnline = false;
    mockFriends = [row('cat', 'incoming')];
    await renderWithTheme(<FriendsSection header={null} handle="me.handle" />);
    expect(screen.getByText(/Social needs a connection/)).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Accept CAT' }).props.accessibilityState,
    ).toMatchObject({
      disabled: true,
    });
  });
});

describe('another person', () => {
  const person = (relationship: PublicProfile['relationship']): PublicProfile => ({
    user_id: 'id-ana',
    handle: 'ana',
    display_name: 'Ana',
    avatar_color: 'rose',
    bio: null,
    relationship,
    friend_count: 3,
  });

  it.each([
    ['none', 'Add friend'],
    ['incoming', 'Accept'],
    ['outgoing', 'Cancel request'],
    ['blocked', 'Unblock'],
  ] as const)('%s shows %s', async (rel, button) => {
    mockProfile = person(rel);
    await renderWithTheme(<SocialUser />);
    expect(screen.getByRole('button', { name: button })).toBeTruthy();
  });

  it('adds a friend', async () => {
    mockProfile = person('none');
    await renderWithTheme(<SocialUser />);
    await press('Add friend');
    expect(mockSend.mock.calls[0]![0]).toBe('ana');
  });

  it('shows a clear state when the profile is hidden', async () => {
    await renderWithTheme(<SocialUser />);
    expect(screen.getByText('Profile not found')).toBeTruthy();
  });
});

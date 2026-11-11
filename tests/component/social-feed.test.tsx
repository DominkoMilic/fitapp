import { fireEvent, screen } from '@testing-library/react-native';

import FeedItemScreen from '@/app/social/item/[id]';
import type { CommentRow, FeedRow } from '@/features/social/api';
import { FeedCard } from '@/features/social/components/FeedCard';

import { renderWithTheme } from '../setup/render';

const mockPush = jest.fn();
const mockAddComment = jest.fn();
const mockCommentsOff = jest.fn();
let mockItem: FeedRow | null = null;
let mockComments: CommentRow[] = [];

jest.mock('expo-router', () => ({
  router: { push: (...a: unknown[]) => mockPush(...a), replace: jest.fn() },
  useLocalSearchParams: () => ({ id: 'item-1' }),
  Stack: { Screen: () => null },
}));
jest.mock('@/navigation/back', () => ({ goBack: jest.fn() }));
jest.mock('@/features/dashboard/useToday', () => ({
  useToday: () => ({ today: '2026-11-18', hour: 10, timezone: 'UTC' }),
}));
const mutation = (fn = jest.fn()) => ({ mutate: fn, isPending: false });
jest.mock('@/features/social/api', () => ({
  errorCode: () => 'unknown',
  useOnline: () => true,
  useFeedItem: () => ({ data: mockItem, isPending: false, isError: false }),
  useComments: () => ({ data: mockComments, isPending: false, isError: false }),
  useAddComment: () => mutation(mockAddComment),
  useDeleteComment: () => mutation(),
  useCheer: () => mutation(),
  useHideFeedItem: () => mutation(),
  useSetCommentsOff: () => mutation(mockCommentsOff),
  useBlockUser: () => mutation(),
  useReport: () => ({ ...mutation(), isSuccess: false, isError: false, reset: jest.fn() }),
}));

const row = (p: Partial<FeedRow> = {}): FeedRow => ({
  id: 'item-1',
  owner: 'u2',
  handle: 'ana',
  display_name: 'Ana',
  avatar_color: 'rose',
  kind: 'activity',
  snapshot: { type: 'run', distance_km: 5.21, moving_min: 28, pace_s_per_km: 322, manual: false },
  local_date: '2026-11-17',
  created_at: '2026-11-17T06:31:00Z',
  cheers: { clap: 2, fire: 1 },
  my_cheer: null,
  comment_count: 1,
  is_mine: false,
  comments_off: false,
  ...p,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockItem = row();
  mockComments = [];
});

describe('feed card', () => {
  it('shows who, when and what, and nothing else', async () => {
    const onCheer = jest.fn();
    await renderWithTheme(
      <FeedCard
        row={row()}
        today="2026-11-18"
        onCheer={onCheer}
        onPickCheer={jest.fn()}
        onMore={jest.fn()}
      />,
    );
    expect(screen.getByText('Ana')).toBeTruthy();
    expect(screen.getByText('@ana · Yesterday')).toBeTruthy();
    expect(screen.getByText('Run')).toBeTruthy();
    expect(screen.getByText('5.21 km · 28 min · 5:22 /km')).toBeTruthy();
    // No clock time (the item was created at 06:31) and no other details.
    expect(screen.queryByText(/06:31|6:31/)).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Cheer' }));
    expect(onCheer).toHaveBeenCalled();
  });

  it('long-press opens the cheer choice', async () => {
    const onPick = jest.fn();
    await renderWithTheme(
      <FeedCard
        row={row()}
        today="2026-11-18"
        onCheer={jest.fn()}
        onPickCheer={onPick}
        onMore={jest.fn()}
      />,
    );
    await fireEvent(screen.getByRole('button', { name: 'Cheer' }), 'longPress');
    expect(onPick).toHaveBeenCalled();
  });

  it('your own post cannot be cheered', async () => {
    await renderWithTheme(
      <FeedCard
        row={row({ is_mine: true })}
        today="2026-11-18"
        onCheer={jest.fn()}
        onPickCheer={jest.fn()}
        onMore={jest.fn()}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Cheer' })).toBeNull();
    expect(screen.getByText('You')).toBeTruthy();
  });

  it('opens the post', async () => {
    await renderWithTheme(
      <FeedCard
        row={row()}
        today="2026-11-18"
        onCheer={jest.fn()}
        onPickCheer={jest.fn()}
        onMore={jest.fn()}
      />,
    );
    await fireEvent.press(screen.getByRole('button', { name: /Ana: Run/ }));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/social/item/[id]',
      params: { id: 'item-1' },
    });
  });
});

describe('post screen', () => {
  it('lists comments and sends a comment', async () => {
    mockComments = [
      {
        id: 'c1',
        author: 'u3',
        handle: 'bo',
        display_name: 'Bo',
        avatar_color: 'sky',
        body: 'Great pace!',
        created_at: '2026-11-17T08:00:00Z',
        removed: false,
        can_delete: false,
        flagged: false,
        is_mine: false,
      },
    ];
    await renderWithTheme(<FeedItemScreen />);
    expect(screen.getByText('Great pace!')).toBeTruthy();
    expect(screen.queryByText('Comment removed')).toBeNull();
    await fireEvent.changeText(screen.getByLabelText('Add a comment'), '  Nice one  ');
    await fireEvent.press(screen.getByRole('button', { name: 'Send comment' }));
    expect(mockAddComment.mock.calls[0]![0]).toEqual({ itemId: 'item-1', body: 'Nice one' });
  });

  const comment = (p: Partial<CommentRow>): CommentRow => ({
    id: 'c1',
    author: 'u3',
    handle: 'bo',
    display_name: 'Bo',
    avatar_color: 'sky',
    body: 'Jebeno brzo!',
    created_at: '2026-11-17T08:00:00Z',
    removed: false,
    can_delete: false,
    flagged: false,
    is_mine: false,
    ...p,
  });

  it('gives every comment a visible ⋯ menu that fits who you are', async () => {
    // On your own post: someone's possibly rude comment can be removed and reported.
    mockItem = row({ is_mine: true, owner: 'me' });
    mockComments = [comment({ can_delete: true, flagged: true })];
    await renderWithTheme(<FeedItemScreen />);
    expect(screen.getByText('May be rude')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: "Options for Bo's comment" }));
    expect(await screen.findByRole('button', { name: 'Remove comment' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Report comment' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Remove comment' }));
    expect(await screen.findByText(/You can remove any comment on your post/)).toBeTruthy();
  });

  it('your own comment on someone else’s post can only be removed', async () => {
    mockComments = [comment({ can_delete: true, is_mine: true })];
    await renderWithTheme(<FeedItemScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Options for your comment' }));
    expect(await screen.findByRole('button', { name: 'Remove comment' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Report comment' })).toBeNull();
  });

  it('with comments off, only cheers remain', async () => {
    mockItem = row({ comments_off: true, comment_count: 0 });
    await renderWithTheme(<FeedItemScreen />);
    expect(screen.getByText('Comments are turned off for this post.')).toBeTruthy();
    expect(screen.queryByText(/No comments yet/)).toBeNull();
    expect(screen.queryByLabelText('Add a comment')).toBeNull();
    expect(screen.queryByRole('button', { name: /comments$/ })).toBeNull();
  });

  it('the owner turns comments off from the post menu', async () => {
    mockItem = row({ is_mine: true, owner: 'me' });
    await renderWithTheme(<FeedItemScreen />);
    await fireEvent.press(screen.getByRole('button', { name: /More/ }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Turn off comments' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Turn off' }));
    expect(mockCommentsOff.mock.calls[0]![0]).toEqual({ id: 'item-1', off: true });
  });

  it('explains a post that is no longer available', async () => {
    mockItem = null;
    await renderWithTheme(<FeedItemScreen />);
    expect(screen.getByText('This post isn’t available')).toBeTruthy();
  });
});

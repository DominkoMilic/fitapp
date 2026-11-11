import { fireEvent, screen } from '@testing-library/react-native';

import { HeaderBack } from '@/navigation/HeaderBack';

import { renderWithTheme } from '../setup/render';

const mockBack = jest.fn();
const mockReplace = jest.fn();
let mockCanGoBack = true;

jest.mock('expo-router', () => ({
  router: {
    back: () => mockBack(),
    replace: (h: unknown) => mockReplace(h),
    canGoBack: () => mockCanGoBack,
  },
}));

beforeEach(() => jest.clearAllMocks());

describe('HeaderBack (first screen of a stack)', () => {
  it('goes back when there is history', async () => {
    mockCanGoBack = true;
    await renderWithTheme(<HeaderBack fallback="/training" />);
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('opens the parent tab after a link or notification (no history)', async () => {
    mockCanGoBack = false;
    await renderWithTheme(<HeaderBack fallback="/training" />);
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(mockReplace).toHaveBeenCalledWith('/training');
  });
});

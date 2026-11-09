import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppErrorBoundary } from '@/components/feedback/AppErrorBoundary';

describe('crash screen (audit fix)', () => {
  it('renders without the theme/data providers and never shows the error text', async () => {
    const retry = jest.fn(async () => undefined);
    await render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 0, left: 0, right: 0, bottom: 0 },
        }}
      >
        <AppErrorBoundary
          error={new Error('relation "secret_table" does not exist')}
          retry={retry}
        />
      </SafeAreaProvider>,
    );
    expect(screen.getByText('Something went wrong')).toBeTruthy();
    expect(screen.queryByText(/secret_table/)).toBeNull();
    await fireEvent.press(screen.getByText('Try again'));
    expect(retry).toHaveBeenCalledTimes(1);
  });
});

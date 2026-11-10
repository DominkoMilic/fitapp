import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { KeyboardController } from 'react-native-keyboard-controller';

import { Button, Card, SegmentedControl, Text, TextField } from '@/components/ui';
import { keyboardDefaults } from '@/components/ui/TextField';
import { ThemeProvider } from '@/theme';
import { palette } from '@/theme/tokens';

import { renderWithTheme } from '../setup/render';

describe('keyboardDefaults', () => {
  it('moves to the next field and keeps the keyboard open by default', () => {
    const d = keyboardDefaults({});
    expect(d.returnKeyType).toBe('next');
    expect(d.submitBehavior).toBe('submit');
    d.onSubmitEditing?.({} as never);
    expect(KeyboardController.setFocusTo).toHaveBeenCalledWith('next');
  });

  it('shows "done" and leaves submitting to the field that has its own handler', () => {
    const d = keyboardDefaults({ onSubmitEditing: () => undefined });
    expect(d.returnKeyType).toBe('done');
    expect(d.submitBehavior).toBe('blurAndSubmit');
    expect(d.onSubmitEditing).toBeUndefined();
  });

  it('keeps Enter as a new line in multiline fields', () => {
    const d = keyboardDefaults({ multiline: true });
    expect(d.returnKeyType).toBeUndefined();
    expect(d.submitBehavior).toBeUndefined();
  });

  it.each([
    { secureTextEntry: true },
    { keyboardType: 'email-address' as const },
    { autoComplete: 'email' as const },
  ])('never capitalises or corrects passwords and emails (%o)', (props) => {
    expect(keyboardDefaults(props)).toMatchObject({
      autoCapitalize: 'none',
      autoCorrect: false,
      spellCheck: false,
    });
  });

  it('leaves ordinary text fields to the platform defaults', () => {
    expect(keyboardDefaults({}).autoCapitalize).toBeUndefined();
  });
});

describe('TextField password', () => {
  it('can show and hide the password', async () => {
    await renderWithTheme(
      <TextField label="Password" secureTextEntry value="secret" onChangeText={() => undefined} />,
    );
    const input = screen.getByLabelText('Password');
    expect(input.props.secureTextEntry).toBe(true);
    expect(input.props.autoCapitalize).toBe('none');
    await fireEvent.press(screen.getByRole('button', { name: 'Show password' }));
    expect(screen.getByLabelText('Password').props.secureTextEntry).toBe(false);
    await fireEvent.press(screen.getByRole('button', { name: 'Hide password' }));
    expect(screen.getByLabelText('Password').props.secureTextEntry).toBe(true);
  });
});

describe('Button borders', () => {
  it.each(['primary', 'secondary', 'ghost', 'destructive'] as const)(
    '%s has a visible border',
    async (variant) => {
      await renderWithTheme(<Button title="Tap" variant={variant} onPress={() => undefined} />);
      const style = StyleSheet.flatten(screen.getByRole('button', { name: 'Tap' }).props.style);
      expect(style.borderWidth).toBeGreaterThan(0);
      expect(style.borderColor).not.toBe('transparent');
    },
  );
});

describe('Card tone', () => {
  const styleOf = async (tone: 'default' | 'success' | 'muted') => {
    await renderWithTheme(
      <Card tone={tone}>
        <Text>Row</Text>
      </Card>,
    );
    // The card is the text's parent view.
    return StyleSheet.flatten(screen.getByText('Row').parent?.props.style);
  };

  it('marks done items with a tinted surface, accent border and a left bar', async () => {
    const s = await styleOf('success');
    const themes = [palette.dark, palette.light];
    expect(themes.map((t) => t.successSurface)).toContain(s.backgroundColor);
    expect(themes.map((t) => t.accent)).toContain(s.borderColor);
    expect(s.borderLeftWidth).toBeGreaterThan(1);
  });

  it('shows locked items with a dashed border', async () => {
    expect((await styleOf('muted')).borderStyle).toBe('dashed');
  });
});

describe('SegmentedControl', () => {
  it('slides one indicator behind the options once they are measured', async () => {
    const onChange = jest.fn();
    await renderWithTheme(
      <SegmentedControl
        accessibilityLabel="Range"
        options={[
          { value: 'a', label: 'Week' },
          { value: 'b', label: 'Month' },
        ]}
        value="a"
        onChange={onChange}
      />,
    );
    expect(screen.queryByTestId('segment-indicator')).toBeNull();
    const layout = (x: number) => ({ nativeEvent: { layout: { x, y: 0, width: 80, height: 44 } } });
    await fireEvent(screen.getByRole('radio', { name: 'Week' }), 'layout', layout(3));
    await fireEvent(screen.getByRole('radio', { name: 'Month' }), 'layout', layout(86));
    expect(screen.getByTestId('segment-indicator')).toBeTruthy();
    await fireEvent.press(screen.getByRole('radio', { name: 'Month' }));
    expect(onChange).toHaveBeenCalledWith('b');
  });
});

describe('Card tap affordance', () => {
  it('a tappable card says it opens something', async () => {
    await renderWithTheme(
      <>
        <Card onPress={() => undefined}>
          <Text>Weight</Text>
        </Card>
        <Card onPress={() => undefined} actionLabel="Start check-in">
          <Text>Feeling</Text>
        </Card>
        <Card>
          <Text>Static</Text>
        </Card>
      </>,
    );
    // Visual only: screen readers already hear the card's hint.
    const hidden = { includeHiddenElements: true };
    expect(screen.getByText('Details', hidden)).toBeTruthy();
    expect(screen.getByText('Start check-in', hidden)).toBeTruthy();
    expect(screen.getAllByText(/Details|Start check-in/, hidden)).toHaveLength(2);
  });
});

describe('StatTile trend', () => {
  it('shows the direction and says what it means', async () => {
    const { StatTile } = jest.requireActual<typeof import('@/components/ui')>('@/components/ui');
    await renderWithTheme(
      <StatTile
        label="Total change"
        value="-2.7"
        unit="kg"
        trend={{ direction: 'down', tone: 'toward' }}
      />,
    );
    expect(screen.getByTestId('trend-down')).toBeTruthy();
    expect(screen.getByLabelText('Total change: -2.7 kg, toward your goal')).toBeTruthy();
  });
});

describe('PasswordChecklist', () => {
  it('ticks rules off as they are met', async () => {
    const { PasswordChecklist } = jest.requireActual<
      typeof import('@/components/forms/PasswordChecklist')
    >('@/components/forms/PasswordChecklist');
    const { rerender } = await renderWithTheme(<PasswordChecklist password="" />);
    expect(screen.queryAllByTestId('rule-met')).toHaveLength(0);
    await rerender(
      <ThemeProvider>
        <PasswordChecklist password="abc" />
      </ThemeProvider>,
    );
    expect(screen.getAllByTestId('rule-met')).toHaveLength(1); // lowercase
    await rerender(
      <ThemeProvider>
        <PasswordChecklist password="Abcdefg1" />
      </ThemeProvider>,
    );
    expect(screen.getAllByTestId('rule-met')).toHaveLength(4);
    expect(screen.getByLabelText('An uppercase letter: done')).toBeTruthy();
  });
});

describe('useFieldErrors', () => {
  it('shows errors on fields and clears one when edited', async () => {
    const { useFieldErrors } =
      jest.requireActual<typeof import('@/hooks/useFieldErrors')>('@/hooks/useFieldErrors');
    const { renderHook, act } = jest.requireActual<typeof import('@testing-library/react-native')>(
      '@testing-library/react-native',
    );
    const { result } = await renderHook(() => useFieldErrors<'weight' | 'date'>());
    let ok = true;
    await act(() => {
      ok = result.current.show({ weight: 'Enter your weight', date: 'Bad date' });
    });
    expect(ok).toBe(false);
    expect(result.current.errors.weight).toBe('Enter your weight');
    await act(() => result.current.clear('weight'));
    expect(result.current.errors).toEqual({ date: 'Bad date' });
  });
});

describe('TextField error', () => {
  it('tints the input and shows the message under it', async () => {
    await renderWithTheme(
      <TextField
        label="Weight"
        value=""
        onChangeText={() => undefined}
        error="Enter your weight"
      />,
    );
    expect(screen.getByTestId('field-error')).toBeTruthy();
    expect(screen.getByText('Enter your weight')).toBeTruthy();
  });
  it('can show the error style without its own message (date parts)', async () => {
    await renderWithTheme(
      <TextField label="Day" value="" onChangeText={() => undefined} invalid />,
    );
    expect(screen.getByTestId('field-error')).toBeTruthy();
  });
});

describe('CalendarSheet', () => {
  const { CalendarSheet } = jest.requireActual<typeof import('@/components/forms/CalendarSheet')>(
    '@/components/forms/CalendarSheet',
  );
  it('picks a day, and days after max cannot be picked', async () => {
    const onSelect = jest.fn();
    const onClose = jest.fn();
    await renderWithTheme(
      <CalendarSheet
        visible
        title="Date"
        value="2026-11-10"
        today="2026-11-10"
        max="2026-11-10"
        onSelect={onSelect}
        onClose={onClose}
      />,
    );
    // The sheet appears once its window has its final size (a short fallback in tests).
    expect(await screen.findByLabelText('10 November 2026, selected, today')).toBeTruthy();
    const future = screen.getByLabelText('11 November 2026, not available');
    expect(future.props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.press(screen.getByLabelText('9 November 2026'));
    expect(onSelect).toHaveBeenCalledWith('2026-11-09');
    // The sheet closes after its exit animation.
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('jumps by year and month for a date of birth', async () => {
    const onSelect = jest.fn();
    await renderWithTheme(
      <CalendarSheet
        visible
        title="Date of birth"
        value={null}
        today="2026-11-10"
        min="1926-11-10"
        max="2008-11-10"
        initialView="years"
        onSelect={onSelect}
        onClose={() => undefined}
      />,
    );
    // Years open on the page containing the latest allowed year; go back one page to 2003.
    await fireEvent.press(await screen.findByLabelText('Earlier years'));
    await fireEvent.press(screen.getByLabelText('2003'));
    await fireEvent.press(screen.getByLabelText('May 2003'));
    await fireEvent.press(screen.getByLabelText('1 May 2003'));
    expect(onSelect).toHaveBeenCalledWith('2003-05-01');
  });
});

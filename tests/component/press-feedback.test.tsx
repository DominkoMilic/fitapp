import { fireEvent, screen } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';

import { Button, ChipGroup, SegmentedControl } from '@/components/ui';

import { renderWithTheme } from '../setup/render';

beforeEach(() => jest.clearAllMocks());

describe('press feedback and haptics', () => {
  it('primary buttons give a light tap; secondary buttons stay silent', async () => {
    const onPress = jest.fn();
    await renderWithTheme(
      <>
        <Button title="Save" onPress={onPress} />
        <Button title="Cancel" variant="secondary" onPress={onPress} />
      </>,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
    expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);
    expect(onPress).toHaveBeenCalledTimes(2);
  });

  it('choosing a chip or a new segment ticks; the selected segment does not', async () => {
    await renderWithTheme(
      <>
        <ChipGroup options={[{ value: 'a', label: 'Apple' }]} selected={[]} onToggle={jest.fn()} />
        <SegmentedControl
          accessibilityLabel="Size"
          options={[
            { value: 's', label: 'Small' },
            { value: 'l', label: 'Large' },
          ]}
          value="s"
          onChange={jest.fn()}
        />
      </>,
    );
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Apple' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Small' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Large' }));
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(2);
  });

  it('disabled buttons do not fire or vibrate', async () => {
    const onPress = jest.fn();
    await renderWithTheme(<Button title="Save" disabled onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(onPress).not.toHaveBeenCalled();
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
  });
});

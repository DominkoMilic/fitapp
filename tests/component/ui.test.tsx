import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { useState } from 'react';

import { Banner, EmptyState } from '@/components/feedback';
import {
  Button,
  Chip,
  FormLock,
  NumberField,
  ProgressBar,
  SegmentedControl,
  TextField,
  Toggle,
} from '@/components/ui';
import { spokenLabel } from '@/components/ui/Button';
import { resolveScheme } from '@/theme';

import { renderWithTheme } from '../setup/render';

describe('Button', () => {
  it('calls onPress', async () => {
    const onPress = jest.fn();
    await renderWithTheme(<Button title="Save" onPress={onPress} />);
    fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not fire while loading or disabled', async () => {
    const onPress = jest.fn();
    await renderWithTheme(
      <>
        <Button title="Loading" loading onPress={onPress} />
        <Button title="Disabled" disabled onPress={onPress} />
      </>,
    );
    fireEvent.press(screen.getByLabelText('Loading'));
    fireEvent.press(screen.getByLabelText('Disabled'));
    expect(onPress).not.toHaveBeenCalled();
  });
});

describe('NumberField', () => {
  function Harness({ onValue }: { onValue: (v: number | null) => void }) {
    const [value, setValue] = useState<number | null>(null);
    return (
      <NumberField
        label="Weight"
        value={value}
        onChangeValue={(v) => {
          setValue(v);
          onValue(v);
        }}
      />
    );
  }

  it('accepts a decimal comma', async () => {
    const onValue = jest.fn();
    await renderWithTheme(<Harness onValue={onValue} />);
    fireEvent.changeText(screen.getByLabelText('Weight'), '108,5');
    expect(onValue).toHaveBeenLastCalledWith(108.5);
  });

  it('reports null for invalid input', async () => {
    const onValue = jest.fn();
    await renderWithTheme(<Harness onValue={onValue} />);
    fireEvent.changeText(screen.getByLabelText('Weight'), '10x');
    expect(onValue).toHaveBeenLastCalledWith(null);
  });
});

describe('ProgressBar', () => {
  it('distinguishes no data from zero', async () => {
    await renderWithTheme(
      <>
        <ProgressBar label="Protein" value={null} max={162} unit="g" />
        <ProgressBar label="Water" value={0} max={3800} unit="ml" />
      </>,
    );
    expect(screen.getByText('No data · target 162 g')).toBeTruthy();
    expect(screen.getByText('0 / 3800 ml')).toBeTruthy();
  });
});

describe('SegmentedControl', () => {
  it('selects an option', async () => {
    const onChange = jest.fn();
    await renderWithTheme(
      <SegmentedControl
        accessibilityLabel="Units"
        options={[
          { value: 'metric', label: 'Metric' },
          { value: 'imperial', label: 'Imperial' },
        ]}
        value="metric"
        onChange={onChange}
      />,
    );
    fireEvent.press(screen.getByRole('radio', { name: 'Imperial' }));
    expect(onChange).toHaveBeenCalledWith('imperial');
  });
});

describe('feedback states', () => {
  it('renders empty and banner states with text', async () => {
    const onAction = jest.fn();
    await renderWithTheme(
      <>
        <EmptyState
          title="No workouts yet"
          message="Plan one"
          actionLabel="Add"
          onAction={onAction}
        />
        <Banner tone="warning" message="Careful" />
      </>,
    );
    fireEvent.press(screen.getByRole('button', { name: 'Add' }));
    expect(onAction).toHaveBeenCalled();
    expect(screen.getByText('Careful')).toBeTruthy();
  });
});

describe('theme', () => {
  it('defaults to dark unless the system or user chooses light', () => {
    expect(resolveScheme('system', null)).toBe('dark');
    expect(resolveScheme('system', 'light')).toBe('light');
    expect(resolveScheme('dark', 'light')).toBe('dark');
    expect(resolveScheme('light', 'dark')).toBe('light');
  });
});

describe('button spoken labels (audit: glyphs are not read aloud)', () => {
  it('strips decorative glyphs', () => {
    expect(spokenLabel('+ Add set')).toBe('Add set');
    expect(spokenLabel('Saved ✓ (tap to remove)')).toBe('Saved (tap to remove)');
    expect(spokenLabel('‹ Prev')).toBe('Prev');
  });
});

describe('FormLock (inputs blocked while saving)', () => {
  it('makes fields read-only and ignores presses while locked', async () => {
    const onToggle = jest.fn();
    const onType = jest.fn();
    const Form = () => {
      const [locked, setLocked] = useState(true);
      return (
        <>
          <Button title="Unlock" onPress={() => setLocked(false)} />
          <FormLock locked={locked}>
            <TextField label="Weight" value="80" onChangeText={onType} />
            <Chip label="Morning" onPress={onToggle} />
            <Toggle label="Remind me" value={false} onChange={onToggle} />
          </FormLock>
        </>
      );
    };
    await renderWithTheme(<Form />);
    expect(screen.getByLabelText('Weight').props.editable).toBe(false);
    fireEvent.press(screen.getByRole('checkbox', { name: 'Morning' }));
    fireEvent.press(screen.getByRole('switch', { name: 'Remind me' }));
    expect(onToggle).not.toHaveBeenCalled();
    expect(screen.getByTestId('form-locked')).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Unlock' }));
    await waitFor(() => expect(screen.queryByTestId('form-locked')).toBeNull());
    expect(screen.getByLabelText('Weight').props.editable).not.toBe(false);
    fireEvent.press(screen.getByRole('checkbox', { name: 'Morning' }));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});

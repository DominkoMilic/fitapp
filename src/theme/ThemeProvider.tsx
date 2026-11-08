import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { AccessibilityInfo, useColorScheme } from 'react-native';

import { type Colors, type ColorScheme, palette } from './tokens';

export type ThemePreference = 'system' | 'light' | 'dark';

interface ThemeContextValue {
  scheme: ColorScheme;
  colors: Colors;
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => void;
  reduceMotion: boolean;
}

const STORAGE_KEY = 'pace.theme-preference';
const ThemeContext = createContext<ThemeContextValue | null>(null);

/** Dark is the default design direction; "system" follows the OS setting. */
export function resolveScheme(
  preference: ThemePreference,
  system: string | null | undefined,
): ColorScheme {
  if (preference === 'light' || preference === 'dark') return preference;
  return system === 'light' ? 'light' : 'dark';
}

export function ThemeProvider({ children }: PropsWithChildren) {
  const system = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((v) => {
        if (v === 'light' || v === 'dark' || v === 'system') setPreferenceState(v);
      })
      .catch(() => undefined);
    AccessibilityInfo.isReduceMotionEnabled()
      .then(setReduceMotion)
      .catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub.remove();
  }, []);

  const value = useMemo<ThemeContextValue>(() => {
    const scheme = resolveScheme(preference, system);
    return {
      scheme,
      colors: palette[scheme],
      preference,
      reduceMotion,
      setPreference: (p) => {
        setPreferenceState(p);
        AsyncStorage.setItem(STORAGE_KEY, p).catch(() => undefined);
      },
    };
  }, [preference, system, reduceMotion]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}

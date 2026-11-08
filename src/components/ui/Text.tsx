import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { type Colors, typography, type TypographyVariant, useTheme } from '@/theme';

export interface TextProps extends RNTextProps {
  variant?: TypographyVariant;
  color?: keyof Colors;
  align?: 'left' | 'center' | 'right';
  /** Tabular numerals for metrics. */
  numeric?: boolean;
}

export function Text({
  variant = 'body',
  color = 'textPrimary',
  align,
  numeric,
  style,
  ...rest
}: TextProps) {
  const { colors } = useTheme();
  return (
    <RNText
      maxFontSizeMultiplier={2}
      style={[
        typography[variant],
        { color: colors[color], textAlign: align },
        numeric ? { fontVariant: ['tabular-nums'] } : null,
        style,
      ]}
      {...rest}
    />
  );
}

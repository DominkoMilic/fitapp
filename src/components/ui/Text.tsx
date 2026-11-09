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

/**
 * Label props for buttons, segments and chips (spec 23.2): a one-word label never breaks inside
 * the word; it stays on one line and shrinks slightly (to 85%) if the space is tight. Longer
 * labels may wrap between words, up to two lines.
 */
export function labelProps(label: string): Partial<RNTextProps> {
  const oneWord = !/\s/.test(label.trim());
  return oneWord
    ? { numberOfLines: 1, adjustsFontSizeToFit: true, minimumFontScale: 0.85 }
    : { numberOfLines: 2, android_hyphenationFrequency: 'none', textBreakStrategy: 'simple' };
}

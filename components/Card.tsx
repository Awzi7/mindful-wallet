import { StyleSheet, View, ViewProps } from 'react-native';
import { useThemeColor } from './Themed';
import { useColorScheme } from './useColorScheme';

type CardVariant = 'default' | 'quiet';

interface CardProps extends ViewProps {
  /**
   * 'default' is the standard raised surface. 'quiet' is a flat, outlined surface for
   * secondary or explanatory blocks, so a screen full of cards still has a visual hierarchy
   * instead of reading as one stack of identical boxes.
   */
  variant?: CardVariant;
}

export function Card({ style, variant = 'default', ...rest }: CardProps) {
  const cardBg = useThemeColor({}, 'card');
  const border = useThemeColor({}, 'border');
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';

  const quiet = variant === 'quiet';

  return (
    <View
      style={[
        styles.card,
        quiet
          ? { backgroundColor: 'transparent', borderWidth: StyleSheet.hairlineWidth, borderColor: border }
          : { backgroundColor: cardBg },
        // A dark shadow is invisible against a dark background, so in dark mode the raised
        // surface gets a hairline outline instead - otherwise cards have no edge at all.
        !quiet && (isDark ? { borderWidth: StyleSheet.hairlineWidth, borderColor: border } : styles.lightShadow),
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
  },
  lightShadow: {
    shadowColor: '#3A2A1A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 1,
  },
});

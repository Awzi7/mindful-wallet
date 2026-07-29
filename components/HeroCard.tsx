import { ReactNode } from 'react';
import { StyleSheet, View, ViewProps } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GRADIENTS, GradientName } from '@/constants/gradients';

interface HeroCardProps extends ViewProps {
  gradient?: GradientName;
  badge?: ReactNode;
  badgePosition?: 'top-right' | 'bottom-left' | 'bottom-right';
}

export function HeroCard({
  gradient = 'sunset',
  badge,
  badgePosition = 'top-right',
  style,
  children,
  ...rest
}: HeroCardProps) {
  const colors = GRADIENTS[gradient];
  return (
    <View style={[styles.wrapper, style]} {...rest}>
      <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.gradient}>
        {children}
      </LinearGradient>
      {badge && (
        <View
          style={[
            styles.badge,
            badgePosition === 'top-right' && styles.badgeTopRight,
            badgePosition === 'bottom-left' && styles.badgeBottomLeft,
            badgePosition === 'bottom-right' && styles.badgeBottomRight,
          ]}>
          {badge}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: 26,
    marginBottom: 18,
  },
  gradient: {
    borderRadius: 26,
    padding: 20,
    overflow: 'hidden',
  },
  badge: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  badgeTopRight: { top: 14, right: 14 },
  badgeBottomLeft: { bottom: -16, left: 18 },
  badgeBottomRight: { bottom: -16, right: 18 },
});

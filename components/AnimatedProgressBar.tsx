import { useEffect } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

export function AnimatedProgressBar({
  progress,
  trackColor,
  fillColor,
  height = 8,
  style,
}: {
  progress: number;
  trackColor: string;
  fillColor: string;
  height?: number;
  style?: ViewStyle;
}) {
  const width = useSharedValue(0);

  useEffect(() => {
    width.value = withTiming(Math.min(100, Math.max(0, progress)), { duration: 700 });
  }, [progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    width: `${width.value}%`,
  }));

  return (
    <View
      style={[
        styles.track,
        { backgroundColor: trackColor, height, borderRadius: height / 2 },
        style,
      ]}>
      <Animated.View
        style={[styles.fill, { backgroundColor: fillColor, height, borderRadius: height / 2 }, animatedStyle]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
  },
});

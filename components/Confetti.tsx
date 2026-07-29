import { useEffect, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

const COLORS = ['#FF6B4A', '#2E9E8F', '#FFC28A', '#7C6CF2', '#E8577D', '#4CC9BA'];
const PIECE_COUNT = 26;

function ConfettiPiece({
  screenWidth,
  screenHeight,
  index,
  onDone,
}: {
  screenWidth: number;
  screenHeight: number;
  index: number;
  onDone?: () => void;
}) {
  const progress = useSharedValue(0);
  const [params] = useState(() => ({
    startX: Math.random() * screenWidth,
    drift: (Math.random() - 0.5) * 160,
    rotation: (Math.random() - 0.5) * 720,
    delay: Math.random() * 150,
    duration: 1400 + Math.random() * 700,
    fallDistance: screenHeight * 0.55 + Math.random() * 80,
    size: 6 + Math.random() * 6,
    color: COLORS[index % COLORS.length],
  }));

  useEffect(() => {
    progress.value = withDelay(
      params.delay,
      withTiming(1, { duration: params.duration, easing: Easing.out(Easing.quad) }, (finished) => {
        if (finished && index === 0 && onDone) runOnJS(onDone)();
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: progress.value * params.fallDistance },
      { translateX: progress.value * params.drift },
      { rotate: `${progress.value * params.rotation}deg` },
    ],
    opacity: 1 - progress.value * 0.4,
  }));

  return (
    <Animated.View
      style={[
        styles.piece,
        {
          left: params.startX,
          width: params.size,
          height: params.size * 1.6,
          backgroundColor: params.color,
        },
        style,
      ]}
    />
  );
}

export function Confetti({ triggerKey, onDone }: { triggerKey: number; onDone?: () => void }) {
  const { width, height } = useWindowDimensions();
  if (!triggerKey) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {Array.from({ length: PIECE_COUNT }).map((_, i) => (
        <ConfettiPiece
          key={`${triggerKey}-${i}`}
          index={i}
          screenWidth={width}
          screenHeight={height}
          onDone={onDone}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  piece: {
    position: 'absolute',
    top: -20,
    borderRadius: 2,
  },
});

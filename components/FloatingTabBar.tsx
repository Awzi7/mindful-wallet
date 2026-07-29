import { ComponentType } from 'react';
import { Pressable, StyleSheet, View, ViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';

import { Text } from './Themed';
import { useThemeColor } from './Themed';
import { useColorScheme } from './useColorScheme';

// expo-glass-effect's GlassView registers a native view manager at import time
// (requireNativeViewManager runs eagerly, not lazily inside a function). On an
// Expo Go build that predates this module, that throws synchronously — so the
// whole require() call must be guarded, not just calls into the module.
type GlassViewComponent = ComponentType<
  ViewProps & { glassEffectStyle?: 'clear' | 'regular' | 'none'; isInteractive?: boolean }
>;

let GlassView: GlassViewComponent | null = null;
let GLASS_AVAILABLE = false;

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const glassEffect = require('expo-glass-effect');
  GlassView = glassEffect.GlassView;
  GLASS_AVAILABLE = glassEffect.isLiquidGlassAvailable();
} catch {
  GlassView = null;
  GLASS_AVAILABLE = false;
}

export function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const card = useThemeColor({}, 'card');
  const border = useThemeColor({}, 'border');
  const tint = useThemeColor({}, 'tint');
  const subtle = useThemeColor({}, 'subtle');
  const ink = useThemeColor({}, 'text');
  const scheme = useColorScheme();

  // Real iOS 26 Liquid Glass when available (custom dev client only — never in Expo Go).
  // Otherwise fall back to expo-blur's frosted-glass effect, which does work in Expo Go,
  // so the tab bar still looks modern rather than a flat card everywhere else.
  const BarContainer: ComponentType<any> = GLASS_AVAILABLE && GlassView ? GlassView : BlurView;
  const barContainerProps = GLASS_AVAILABLE
    ? { glassEffectStyle: 'regular' as const, isInteractive: true }
    : { tint: (scheme === 'dark' ? 'dark' : 'light') as 'dark' | 'light', intensity: 65 };
  const barStyle = [styles.bar, GLASS_AVAILABLE ? null : { borderColor: border, borderWidth: StyleSheet.hairlineWidth }];

  return (
    <View style={[styles.wrapper, { paddingBottom: Math.max(insets.bottom, 12) }]} pointerEvents="box-none">
      <View style={styles.shadowWrapper}>
        <BarContainer style={barStyle} {...barContainerProps}>
          {!GLASS_AVAILABLE && (
            <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: card, opacity: 0.55 }]} />
          )}
          {state.routes.map((route, index) => {
            // Settings moved behind a header icon on Home instead of living in the tab bar.
            // The classic expo-router Tabs (unlike expo-router/ui) has no href:null support,
            // so filtering state.routes here is the only way to hide it from a custom tab bar.
            if (route.name === 'settings') return null;
            const { options } = descriptors[route.key];
            const focused = state.index === index;
            const label = (options.title ?? route.name) as string;

            const onPress = () => {
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                navigation.navigate(route.name);
              }
            };

            return (
              <Pressable
                key={route.key}
                onPress={onPress}
                style={styles.item}
                accessibilityRole="tab"
                accessibilityState={{ selected: focused }}
                accessibilityLabel={label}>
                <View style={[styles.iconWrap, focused && { backgroundColor: tint }]}>
                  {options.tabBarIcon?.({
                    focused,
                    color: focused ? 'white' : subtle,
                    size: 20,
                  })}
                </View>
                <Text
                  numberOfLines={1}
                  style={[styles.label, { color: focused ? ink : subtle, fontWeight: focused ? '700' : '500' }]}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </BarContainer>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  shadowWrapper: {
    borderRadius: 28,
    shadowColor: '#3A2A1A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
    elevation: 6,
  },
  bar: {
    flexDirection: 'row',
    borderRadius: 28,
    overflow: 'hidden',
    paddingVertical: 10,
    paddingHorizontal: 6,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  iconWrap: {
    width: 38,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 10,
  },
});

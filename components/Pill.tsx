import { Pressable, PressableProps, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Text } from './Themed';
import { useThemeColor } from './Themed';

interface PillProps extends PressableProps {
  label: string;
  active?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
}

export function Pill({ label, active, icon, style, onPress, ...rest }: PillProps) {
  const tint = useThemeColor({}, 'tint');
  const border = useThemeColor({}, 'border');
  const card = useThemeColor({}, 'card');

  return (
    <Pressable
      style={(state) => [
        styles.pill,
        {
          borderColor: active ? tint : border,
          backgroundColor: active ? tint : card,
        },
        typeof style === 'function' ? style(state) : style,
      ]}
      onPress={(e) => {
        Haptics.selectionAsync();
        onPress?.(e);
      }}
      accessibilityRole="radio"
      accessibilityState={{ checked: active }}
      accessibilityLabel={label}
      {...rest}>
      <View style={styles.row}>
        {icon && <Ionicons name={icon} size={15} color={active ? 'white' : tint} />}
        <Text style={[styles.label, { color: active ? 'white' : undefined, fontWeight: active ? '700' : '500' }]}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    borderWidth: 1.5,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  label: {
    fontSize: 13,
  },
});

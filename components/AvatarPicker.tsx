import { Pressable, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Text, useThemeColor } from './Themed';

export const AVATAR_CHOICES = ['😊', '😎', '🤓', '🥳', '🦊', '🐱', '🐶', '🦁', '🐼', '🌟', '🚀', '💎'];

export function AvatarPicker({ value, onChange }: { value: string; onChange: (avatar: string) => void }) {
  const tint = useThemeColor({}, 'tint');
  const border = useThemeColor({}, 'border');
  const card = useThemeColor({}, 'card');

  return (
    <View style={styles.row} accessibilityRole="radiogroup">
      {AVATAR_CHOICES.map((emoji) => {
        const active = value === emoji;
        return (
          <Pressable
            key={emoji}
            onPress={() => {
              Haptics.selectionAsync();
              onChange(emoji);
            }}
            style={[styles.cell, { borderColor: active ? tint : border, backgroundColor: active ? tint + '22' : card }]}
            accessibilityRole="radio"
            accessibilityState={{ checked: active }}
            accessibilityLabel={emoji}>
            <Text style={styles.emoji}>{emoji}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  cell: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    fontSize: 22,
  },
});

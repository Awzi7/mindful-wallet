import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text, useThemeColor } from './Themed';

export function SectionHeader({
  icon,
  title,
  subtitle,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
}) {
  const tint = useThemeColor({}, 'tint');
  const subtle = useThemeColor({}, 'subtle');

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Ionicons name={icon} size={17} color={tint} style={styles.icon} />
        <Text style={styles.title}>{title}</Text>
      </View>
      {subtitle && <Text style={[styles.subtitle, { color: subtle }]}>{subtitle}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginRight: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 12.5,
    lineHeight: 18,
    marginTop: 4,
  },
});

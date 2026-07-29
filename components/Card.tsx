import { StyleSheet, View, ViewProps } from 'react-native';
import { useThemeColor } from './Themed';

export function Card({ style, ...rest }: ViewProps) {
  const backgroundColor = useThemeColor({}, 'card');
  return <View style={[styles.card, { backgroundColor }, style]} {...rest} />;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#3A2A1A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 1,
  },
});

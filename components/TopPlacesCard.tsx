import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Text, useThemeColor } from './Themed';
import { formatMoney } from '@/lib/format';
import { PlaceTotal } from '@/lib/places';
import { CurrencyCode } from '@/lib/types';
import { useI18n } from '@/lib/i18n';

export function TopPlacesCard({ places, currency }: { places: PlaceTotal[]; currency: CurrencyCode }) {
  const { t } = useI18n();
  const subtle = useThemeColor({}, 'subtle');
  const tint = useThemeColor({}, 'tint');

  if (places.length === 0) return null;

  const max = places[0].amount;

  return (
    <View>
      <Text style={styles.title}>{t('home.placesTitle')}</Text>
      <Text style={[styles.subtitle, { color: subtle }]}>{t('home.placesSubtitle')}</Text>
      {places.map((p) => (
        <View key={p.place} style={styles.row}>
          <View style={styles.rowHeader}>
            <Ionicons name="location-outline" size={14} color={tint} />
            <Text style={styles.placeText} numberOfLines={1}>
              {p.place}
            </Text>
            <Text style={styles.amountText}>{formatMoney(p.amount, currency)}</Text>
          </View>
          {/* Bar is relative to the biggest place, so the list reads at a glance. */}
          <View style={[styles.barTrack, { backgroundColor: `${tint}22` }]}>
            <View style={[styles.barFill, { backgroundColor: tint, width: `${Math.max(4, (p.amount / max) * 100)}%` }]} />
          </View>
          <Text style={[styles.countText, { color: subtle }]}>{t('home.placesVisits', { count: p.count })}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
    marginBottom: 12,
  },
  row: {
    marginBottom: 12,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  placeText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  amountText: {
    fontSize: 14,
    fontWeight: '700',
    flexShrink: 0,
  },
  barTrack: {
    height: 6,
    borderRadius: 3,
    marginTop: 6,
    overflow: 'hidden',
  },
  barFill: {
    height: 6,
    borderRadius: 3,
  },
  countText: {
    fontSize: 11,
    marginTop: 4,
  },
});

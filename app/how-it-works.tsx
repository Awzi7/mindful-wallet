import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text, useThemeColor } from '@/components/Themed';
import { Card } from '@/components/Card';
import { HeroCard } from '@/components/HeroCard';
import { useI18n } from '@/lib/i18n';

const FEATURES: { icon: keyof typeof Ionicons.glyphMap; titleKey: string; descKey: string; route: string }[] = [
  { icon: 'add-circle-outline', titleKey: 'howItWorks.addTitle', descKey: 'howItWorks.addDesc', route: '/(tabs)/add' },
  { icon: 'sparkles-outline', titleKey: 'howItWorks.coachTitle', descKey: 'howItWorks.coachDesc', route: '/(tabs)/coach' },
  { icon: 'flag-outline', titleKey: 'howItWorks.goalsTitle', descKey: 'howItWorks.goalsDesc', route: '/(tabs)/goals' },
  { icon: 'calendar-outline', titleKey: 'howItWorks.historyTitle', descKey: 'howItWorks.historyDesc', route: '/(tabs)/history' },
  { icon: 'location-outline', titleKey: 'howItWorks.hotspotTitle', descKey: 'howItWorks.hotspotDesc', route: '/(tabs)' },
  { icon: 'settings-outline', titleKey: 'howItWorks.settingsTitle', descKey: 'howItWorks.settingsDesc', route: '/(tabs)/settings' },
];

export default function HowItWorksScreen() {
  const { t } = useI18n();
  const subtle = useThemeColor({}, 'subtle');
  const accent = useThemeColor({}, 'accent');
  const accentSoft = useThemeColor({}, 'accentSoft');
  const tint = useThemeColor({}, 'tint');
  const insets = useSafeAreaInsets();

  const done = () => router.replace('/(tabs)');

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable
          style={[styles.closeButton, { top: insets.top + 8, backgroundColor: accentSoft }]}
          onPress={done}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}>
          <Ionicons name="close" size={18} color={accent} />
        </Pressable>

        <HeroCard gradient="dusk" style={{ marginTop: insets.top + 36 }}>
          <Text style={styles.heroTitle}>{t('howItWorks.title')}</Text>
          <Text style={styles.heroSubtitle}>{t('howItWorks.subtitle')}</Text>
        </HeroCard>

        {FEATURES.map((f) => (
          <Pressable key={f.titleKey} onPress={() => router.push(f.route as Parameters<typeof router.push>[0])}>
            <Card style={styles.featureRow}>
              <View style={[styles.featureIcon, { backgroundColor: accentSoft }]}>
                <Ionicons name={f.icon} size={20} color={accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.featureTitle}>{t(f.titleKey)}</Text>
                <Text style={[styles.featureDesc, { color: subtle }]}>{t(f.descKey)}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={subtle} />
            </Card>
          </Pressable>
        ))}

        <Pressable style={[styles.doneButton, { backgroundColor: tint }]} onPress={done}>
          <Text style={styles.doneButtonText}>{t('howItWorks.done')}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    padding: 20,
    paddingBottom: 48,
  },
  closeButton: {
    position: 'absolute',
    top: 8,
    right: 20,
    zIndex: 1,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: 'white',
    marginBottom: 6,
  },
  heroSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(255,255,255,0.92)',
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  featureIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  featureDesc: {
    fontSize: 12.5,
    lineHeight: 17,
  },
  doneButton: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 12,
  },
  doneButtonText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 15,
  },
});

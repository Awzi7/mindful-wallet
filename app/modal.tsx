import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text, View, useThemeColor } from '@/components/Themed';
import { Card } from '@/components/Card';
import { getGamification } from '@/lib/storage';
import { Achievement } from '@/lib/types';
import { useI18n } from '@/lib/i18n';

export default function AchievementsModal() {
  const { t } = useI18n();
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [points, setPoints] = useState(0);
  const [streak, setStreak] = useState(0);
  const accent = useThemeColor({}, 'accent');
  const accentSoft = useThemeColor({}, 'accentSoft');
  const insets = useSafeAreaInsets();

  useFocusEffect(
    useCallback(() => {
      getGamification().then((state) => {
        setAchievements([...state.achievements].reverse());
        setPoints(state.points);
        setStreak(state.streak);
      });
    }, [])
  );

  const dayWord = streak === 1 ? t('achievementsModal.dayWordOne') : t('achievementsModal.dayWordFew');

  return (
    <View style={styles.container}>
      <Pressable
        style={[styles.closeButton, { top: insets.top + 8, backgroundColor: accentSoft }]}
        onPress={() => router.back()}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={t('common.close')}>
        <Ionicons name="close" size={18} color={accent} />
      </Pressable>

      <View style={[styles.titleRow, { marginTop: insets.top + 36 }]}>
        <Ionicons name="trophy-outline" size={20} color={accent} style={{ marginRight: 8 }} />
        <Text style={styles.title}>{t('achievementsModal.title')}</Text>
      </View>
      <Text style={styles.subtitle}>{t('achievementsModal.statsLine', { points, streak, dayWord })}</Text>

      {achievements.length === 0 ? (
        <Card style={styles.emptyCard}>
          <Text style={styles.emptyText}>{t('achievementsModal.empty')}</Text>
        </Card>
      ) : (
        <FlatList
          data={achievements}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 24 }}
          renderItem={({ item }) => (
            <Card style={styles.achievementCard}>
              <View style={[styles.achievementIcon, { backgroundColor: accentSoft }]}>
                <Ionicons name="trophy" size={18} color={accent} />
              </View>
              <View style={{ flex: 1, backgroundColor: 'transparent' }}>
                <Text style={styles.achievementTitle}>{t(`achievements.${item.id}.title`)}</Text>
                <Text style={styles.achievementDesc}>{t(`achievements.${item.id}.description`, item.params)}</Text>
              </View>
            </Card>
          )}
        />
      )}

      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  closeButton: {
    position: 'absolute',
    right: 20,
    zIndex: 1,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 14,
    opacity: 0.6,
    marginBottom: 20,
  },
  emptyCard: {
    alignItems: 'center',
  },
  emptyText: {
    textAlign: 'center',
    opacity: 0.7,
    lineHeight: 20,
  },
  achievementCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  achievementIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  achievementTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  achievementDesc: {
    fontSize: 13,
    opacity: 0.7,
    lineHeight: 18,
  },
});

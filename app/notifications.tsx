import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text, useThemeColor } from '@/components/Themed';
import { Card } from '@/components/Card';
import { getNotifications, markAllNotificationsRead } from '@/lib/storage';
import { AppNotification } from '@/lib/types';
import { useI18n } from '@/lib/i18n';
import { LOCALE_MAP } from '@/lib/i18n/dictionaries';

export default function NotificationsScreen() {
  const { t, language } = useI18n();
  const [items, setItems] = useState<AppNotification[]>([]);

  const subtle = useThemeColor({}, 'subtle');
  const accent = useThemeColor({}, 'accent');
  const accentSoft = useThemeColor({}, 'accentSoft');
  const insets = useSafeAreaInsets();

  useFocusEffect(
    useCallback(() => {
      getNotifications().then(setItems);
      markAllNotificationsRead();
    }, [])
  );

  const close = () => router.back();

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable
          style={[styles.closeButton, { top: insets.top + 8, backgroundColor: accentSoft }]}
          onPress={close}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}>
          <Ionicons name="close" size={18} color={accent} />
        </Pressable>

        <Text style={[styles.title, { marginTop: insets.top + 36 }]}>{t('notifications.title')}</Text>

        {items.length === 0 ? (
          <Card>
            <Text style={[styles.emptyText, { color: subtle }]}>{t('notifications.empty')}</Text>
          </Card>
        ) : (
          items.map((n) => (
            <Card key={n.id} style={styles.row}>
              <View style={[styles.rowIcon, { backgroundColor: accentSoft }]}>
                <Ionicons name="notifications-outline" size={18} color={accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{n.title}</Text>
                <Text style={[styles.rowBody, { color: subtle }]}>{n.body}</Text>
                <Text style={[styles.rowTime, { color: subtle }]}>
                  {new Date(n.createdAt).toLocaleString(LOCALE_MAP[language] ?? 'en-US', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              </View>
            </Card>
          ))
        )}
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
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 36,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  rowBody: {
    fontSize: 13,
    lineHeight: 18,
  },
  rowTime: {
    fontSize: 11,
    marginTop: 6,
  },
});

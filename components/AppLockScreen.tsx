import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Text, useThemeColor } from './Themed';
import { useI18n } from '@/lib/i18n';

export function AppLockScreen({ onUnlock }: { onUnlock: () => Promise<boolean> }) {
  const { t } = useI18n();
  const [authenticating, setAuthenticating] = useState(true);
  const [failed, setFailed] = useState(false);
  const background = useThemeColor({}, 'background');
  const tint = useThemeColor({}, 'tint');
  const subtle = useThemeColor({}, 'subtle');

  const attempt = async () => {
    setAuthenticating(true);
    setFailed(false);
    const ok = await onUnlock();
    setAuthenticating(false);
    if (!ok) setFailed(true);
  };

  useEffect(() => {
    attempt();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: background }]}>
      <View style={[styles.iconCircle, { borderColor: tint }]}>
        <Ionicons name="lock-closed" size={36} color={tint} />
      </View>
      <Text style={styles.title}>{t('appLock.title')}</Text>
      {authenticating ? (
        <ActivityIndicator color={tint} style={{ marginTop: 20 }} />
      ) : (
        <>
          {failed && <Text style={[styles.failed, { color: subtle }]}>{t('appLock.failed')}</Text>}
          <Pressable style={[styles.button, { backgroundColor: tint }]} onPress={attempt}>
            <Text style={styles.buttonText}>{t('appLock.unlockButton')}</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  failed: {
    fontSize: 13,
    marginTop: 12,
    marginBottom: 4,
  },
  button: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 20,
  },
  buttonText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 15,
  },
});

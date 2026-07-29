import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, useThemeColor } from './Themed';
import { getCurrency, saveTodayCheckIn } from '@/lib/storage';
import { CURRENCY_META, CurrencyCode } from '@/lib/types';
import { useI18n } from '@/lib/i18n';

export function DailyCheckInModal({
  visible,
  onDone,
}: {
  visible: boolean;
  onDone: () => void;
}) {
  const { t } = useI18n();
  const [foodLimit, setFoodLimit] = useState('');
  const [bigPurchase, setBigPurchase] = useState('');
  const [currency, setCurrency] = useState<CurrencyCode>('USD');
  const border = useThemeColor({}, 'border');
  const subtle = useThemeColor({}, 'subtle');
  const cardBg = useThemeColor({}, 'card');
  const textColor = useThemeColor({}, 'text');
  const insets = useSafeAreaInsets();

  useEffect(() => {
    getCurrency().then(setCurrency);
  }, [visible]);

  const handleSave = async () => {
    await saveTodayCheckIn({
      foodLimit: foodLimit ? Number(foodLimit.replace(/[^0-9]/g, '')) : null,
      bigPurchaseNote: bigPurchase.trim(),
    });
    onDone();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? -insets.bottom : 0}>
        <View style={[styles.sheet, { borderColor: border, backgroundColor: cardBg }]}>
          <Text style={styles.emoji}>🌅</Text>
          <Text style={styles.title}>{t('checkin.title')}</Text>
          <Text style={[styles.subtitle, { color: subtle }]}>{t('checkin.subtitle')}</Text>

          <Text style={styles.label}>{t('checkin.foodLimitLabel', { symbol: CURRENCY_META[currency].symbol })}</Text>
          <TextInput
            style={[styles.input, { borderColor: border, color: textColor }]}
            keyboardType="number-pad"
            placeholder={t('checkin.foodLimitPlaceholder')}
            placeholderTextColor={subtle}
            value={foodLimit}
            onChangeText={setFoodLimit}
          />

          <Text style={styles.label}>{t('checkin.bigPurchaseLabel')}</Text>
          <TextInput
            style={[styles.input, { borderColor: border, color: textColor }]}
            placeholder={t('checkin.bigPurchasePlaceholder', { symbol: CURRENCY_META[currency].symbol })}
            placeholderTextColor={subtle}
            value={bigPurchase}
            onChangeText={setBigPurchase}
          />

          <Pressable style={styles.button} onPress={handleSave}>
            <Text style={styles.buttonText}>{t('checkin.startButton')}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 24,
    paddingBottom: 40,
  },
  emoji: {
    fontSize: 32,
    textAlign: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#2E9E8F',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 15,
  },
});

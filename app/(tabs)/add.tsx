import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';

import { Text, useThemeColor } from '@/components/Themed';
import { Card } from '@/components/Card';
import { Pill } from '@/components/Pill';
import { addCustomCategory, addPoints, addTransaction, getCurrency, getCustomCategories, getTransactions } from '@/lib/storage';
import { getSpendingNudge } from '@/lib/coach';
import { AIError } from '@/lib/ai';
import { getAllCategoriesResolved, resolveCategoryIcon, resolveCategoryLabel } from '@/lib/categories';
import { CURRENCY_META, CUSTOM_CATEGORY_COLOR_CHOICES, CUSTOM_CATEGORY_ICON_CHOICES, CurrencyCode, CustomCategory, Transaction } from '@/lib/types';
import { formatMoney } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { LOCALE_MAP } from '@/lib/i18n/dictionaries';
import { usePremium, FREE_CUSTOM_CATEGORY_LIMIT, hasReachedFreeLimit } from '@/lib/premium';

export default function AddExpenseScreen() {
  const { t, language } = useI18n();
  const { isPremium } = usePremium();
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('cafe');
  const [place, setPlace] = useState('');
  const [note, setNote] = useState('');
  const [currency, setCurrency] = useState<CurrencyCode>('USD');
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>([]);
  const [recentTxs, setRecentTxs] = useState<Transaction[]>([]);

  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryLabel, setNewCategoryLabel] = useState('');
  const [newCategoryIcon, setNewCategoryIcon] = useState(CUSTOM_CATEGORY_ICON_CHOICES[0]);
  const [newCategoryColor, setNewCategoryColor] = useState(CUSTOM_CATEGORY_COLOR_CHOICES[0]);
  const [saveAsPermanent, setSaveAsPermanent] = useState(true);
  const [categoryLimitNotice, setCategoryLimitNotice] = useState(false);
  const [oneTimeCategory, setOneTimeCategory] = useState<{ label: string; icon: string; color: string } | null>(null);

  const [savedTx, setSavedTx] = useState<Transaction | null>(null);
  const [nudge, setNudge] = useState<string | null>(null);
  const [nudgeLoading, setNudgeLoading] = useState(false);
  const [nudgeError, setNudgeError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const tint = useThemeColor({}, 'tint');
  const subtle = useThemeColor({}, 'subtle');
  const border = useThemeColor({}, 'border');
  const textColor = useThemeColor({}, 'text');
  const accent = useThemeColor({}, 'accent');
  const accentSoft = useThemeColor({}, 'accentSoft');

  const refreshRecent = useCallback(() => {
    getTransactions().then((list) => setRecentTxs(list.slice(0, 3)));
  }, []);

  useFocusEffect(
    useCallback(() => {
      getCurrency().then(setCurrency);
      getCustomCategories().then(setCustomCategories);
      refreshRecent();
    }, [refreshRecent])
  );

  const allCategories = getAllCategoriesResolved(customCategories, t);
  const amountNumber = Number(amount.replace(/[^0-9]/g, ''));
  const canSave = amountNumber > 0;

  const resetForm = () => {
    setAmount('');
    setPlace('');
    setNote('');
  };

  const handleSave = async () => {
    if (!canSave) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSaving(true);
    const tx = await addTransaction({
      amount: amountNumber,
      category,
      place: place.trim() || undefined,
      note: note.trim() || undefined,
    });
    await addPoints(3);
    setSavedTx(tx);
    setSaving(false);
    resetForm();
    refreshRecent();

    setNudgeLoading(true);
    setNudgeError(null);
    setNudge(null);
    try {
      const text = await getSpendingNudge(tx, isPremium);
      setNudge(text);
    } catch (e) {
      setNudgeError(e instanceof AIError ? e.message : t('add.nudgeError'));
    } finally {
      setNudgeLoading(false);
    }
  };

  const handleAddCategory = async () => {
    const label = newCategoryLabel.trim();
    if (!label) return;
    if (saveAsPermanent) {
      if (hasReachedFreeLimit(isPremium, customCategories.length, FREE_CUSTOM_CATEGORY_LIMIT)) {
        setCategoryLimitNotice(true);
        return;
      }
      const next = await addCustomCategory({ label, icon: newCategoryIcon, color: newCategoryColor });
      setCustomCategories(next);
      setCategory(next[next.length - 1].id);
      setOneTimeCategory(null);
    } else {
      // A one-off category: resolveCategoryLabel/Icon already fall back to showing the raw
      // string when it matches neither a built-in nor a persisted custom category.
      setCategory(label);
      setOneTimeCategory({ label, icon: newCategoryIcon, color: newCategoryColor });
    }
    setNewCategoryLabel('');
    setNewCategoryIcon(CUSTOM_CATEGORY_ICON_CHOICES[0]);
    setNewCategoryColor(CUSTOM_CATEGORY_COLOR_CHOICES[0]);
    setSaveAsPermanent(true);
    setAddingCategory(false);
  };

  const savedCategoryLabel = savedTx ? resolveCategoryLabel(savedTx.category, customCategories, t) : '';

  const pillCategories =
    oneTimeCategory && !allCategories.some((c) => c.id === category)
      ? [...allCategories, { id: oneTimeCategory.label, label: oneTimeCategory.label, icon: oneTimeCategory.icon, color: oneTimeCategory.color }]
      : allCategories;

  return (
    <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      <Card>
        <Text style={styles.label}>{t('add.amountLabel', { symbol: CURRENCY_META[currency].symbol })}</Text>
        <TextInput
          style={[styles.amountInput, { borderColor: border, color: textColor }]}
          keyboardType="number-pad"
          placeholder="0"
          placeholderTextColor={subtle}
          value={amount}
          onChangeText={setAmount}
        />

        <Text style={styles.label}>{t('add.categoryLabel')}</Text>
        <View style={styles.chipRow}>
          {pillCategories.map((cat) => (
            <Pill
              key={cat.id}
              label={cat.label}
              icon={cat.icon as keyof typeof Ionicons.glyphMap}
              active={category === cat.id}
              onPress={() => setCategory(cat.id)}
            />
          ))}
        </View>

        {!addingCategory ? (
          <Pressable style={styles.addCategoryRow} onPress={() => setAddingCategory(true)}>
            <Text style={{ color: tint, fontWeight: '600', fontSize: 13 }}>{t('settings.addCategory')}</Text>
          </Pressable>
        ) : (
          <View style={styles.newCategoryBox}>
            <TextInput
              style={[styles.input, { borderColor: border, color: textColor }]}
              placeholder={t('settings.newCategoryPlaceholder')}
              placeholderTextColor={subtle}
              value={newCategoryLabel}
              onChangeText={setNewCategoryLabel}
            />
            <View style={styles.pickerRow}>
              {CUSTOM_CATEGORY_ICON_CHOICES.map((icon) => (
                <Pressable
                  key={icon}
                  onPress={() => setNewCategoryIcon(icon)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: newCategoryIcon === icon }}
                  accessibilityLabel={icon.replace('-outline', '').replace(/-/g, ' ')}
                  style={[
                    styles.iconChoice,
                    {
                      borderColor: newCategoryIcon === icon ? newCategoryColor : border,
                      backgroundColor: newCategoryIcon === icon ? newCategoryColor + '22' : 'transparent',
                    },
                  ]}>
                  <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={18} color={newCategoryIcon === icon ? newCategoryColor : subtle} />
                </Pressable>
              ))}
            </View>
            <View style={styles.pickerRow}>
              {CUSTOM_CATEGORY_COLOR_CHOICES.map((color) => (
                <Pressable
                  key={color}
                  onPress={() => setNewCategoryColor(color)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: newCategoryColor === color }}
                  accessibilityLabel={color}
                  style={[
                    styles.colorChoice,
                    { backgroundColor: color, borderColor: newCategoryColor === color ? textColor : 'transparent' },
                  ]}
                />
              ))}
            </View>

            <Pressable
              style={styles.checkboxRow}
              onPress={() => setSaveAsPermanent((v) => !v)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: saveAsPermanent }}>
              <View style={[styles.checkbox, { borderColor: tint, backgroundColor: saveAsPermanent ? tint : 'transparent' }]}>
                {saveAsPermanent && <Ionicons name="checkmark" size={14} color="white" />}
              </View>
              <Text style={[styles.smallText, { color: subtle, flex: 1 }]}>{t('add.saveAsPermanentLabel')}</Text>
            </Pressable>
            {!saveAsPermanent && (
              <Text style={[styles.hint, { color: subtle }]}>{t('add.oneTimeCategoryHint')}</Text>
            )}

            {categoryLimitNotice && (
              <View style={[styles.infoBanner, { borderColor: accent, backgroundColor: accentSoft }]}>
                <View style={styles.infoBannerContent}>
                  <Text style={[styles.infoBannerTitle, { color: accent }]}>{t('premium.limitCategoriesTitle')}</Text>
                  <Text style={[styles.infoBannerBody, { color: subtle }]}>
                    {t('premium.limitCategoriesBody', { limit: FREE_CUSTOM_CATEGORY_LIMIT })}
                  </Text>
                  <Pressable
                    onPress={() => {
                      setCategoryLimitNotice(false);
                      router.push('/paywall');
                    }}>
                    <Text style={[styles.infoBannerLink, { color: accent }]}>{t('premium.upgradeLink')}</Text>
                  </Pressable>
                </View>
                <Pressable
                  onPress={() => setCategoryLimitNotice(false)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={t('common.close')}>
                  <Ionicons name="close" size={16} color={subtle} />
                </Pressable>
              </View>
            )}

            <View style={styles.editRow}>
              <Pressable
                style={[styles.smallButton, { backgroundColor: newCategoryLabel.trim() ? tint : border }]}
                onPress={handleAddCategory}
                disabled={!newCategoryLabel.trim()}>
                <Text style={{ color: 'white', fontWeight: '700' }}>{t('settings.newCategorySave')}</Text>
              </Pressable>
              <Pressable style={[styles.smallButton, { borderColor: border, borderWidth: 1 }]} onPress={() => setAddingCategory(false)}>
                <Text style={{ color: subtle }}>{t('common.cancel')}</Text>
              </Pressable>
            </View>
          </View>
        )}

        <Text style={styles.label}>{t('add.placeLabel')}</Text>
        <TextInput
          style={[styles.input, { borderColor: border, color: textColor }]}
          placeholder={t('add.placePlaceholder')}
          placeholderTextColor={subtle}
          value={place}
          onChangeText={setPlace}
        />

        <Text style={styles.label}>{t('add.noteLabel')}</Text>
        <TextInput
          style={[styles.input, { borderColor: border, color: textColor }]}
          placeholder={t('add.notePlaceholder')}
          placeholderTextColor={subtle}
          value={note}
          onChangeText={setNote}
        />

        <Pressable
          style={[styles.saveButton, { backgroundColor: canSave ? tint : border }]}
          onPress={handleSave}
          disabled={!canSave || saving}>
          {saving ? <ActivityIndicator color="white" /> : <Text style={styles.saveButtonText}>{t('add.saveButton')}</Text>}
        </Pressable>
      </Card>

      {savedTx && (
        <Card>
          <Text style={styles.cardTitle}>
            {t('add.savedLine', { amount: formatMoney(savedTx.amount, currency), category: savedCategoryLabel })}
          </Text>
          {nudgeLoading ? (
            <ActivityIndicator style={{ marginVertical: 8 }} />
          ) : nudgeError ? (
            <Text style={[styles.smallText, { color: subtle }]}>{nudgeError}</Text>
          ) : (
            <Text style={styles.bodyText}>{nudge}</Text>
          )}
        </Card>
      )}

      {recentTxs.length > 0 && (
        <Card>
          <View style={styles.recentHeaderRow}>
            <Text style={styles.cardTitle}>{t('add.recentTitle')}</Text>
            <Pressable onPress={() => router.push('/(tabs)/history')} accessibilityRole="button" accessibilityLabel={t('add.viewAllHistory')}>
              <View style={styles.viewAllRow}>
                <Text style={{ color: tint, fontSize: 13, fontWeight: '600' }}>{t('add.viewAllHistory')}</Text>
                <Ionicons name="chevron-forward" size={14} color={tint} />
              </View>
            </Pressable>
          </View>
          {recentTxs.map((tx, i) => {
            const label = resolveCategoryLabel(tx.category, customCategories, t);
            const icon = resolveCategoryIcon(tx.category, customCategories);
            const time = new Date(tx.createdAt).toLocaleTimeString(LOCALE_MAP[language] ?? 'en-US', {
              hour: '2-digit',
              minute: '2-digit',
            });
            return (
              <View
                key={tx.id}
                style={[styles.txRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: border }]}>
                <View style={[styles.txIcon, { backgroundColor: accentSoft }]}>
                  <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={16} color={accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.txLabel}>{label}</Text>
                  <Text style={[styles.txSub, { color: subtle }]}>
                    {time}
                    {tx.place ? ` · ${tx.place}` : ''}
                  </Text>
                </View>
                <Text style={styles.txAmount}>{formatMoney(tx.amount, currency)}</Text>
              </View>
            );
          })}
        </Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    padding: 16,
    paddingBottom: 48,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
    marginTop: 10,
  },
  amountInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 28,
    fontWeight: '700',
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  saveButton: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 18,
  },
  saveButtonText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 15,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 8,
  },
  bodyText: {
    fontSize: 14,
    lineHeight: 21,
  },
  smallText: {
    fontSize: 12,
  },
  hint: {
    fontSize: 11,
    lineHeight: 16,
    marginTop: 6,
  },
  addCategoryRow: {
    paddingVertical: 10,
  },
  newCategoryBox: {
    marginTop: 4,
    marginBottom: 4,
  },
  pickerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  iconChoice: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorChoice: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  smallButton: {
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
    gap: 10,
  },
  infoBannerContent: {
    flex: 1,
  },
  infoBannerTitle: {
    fontWeight: '700',
    fontSize: 13,
    marginBottom: 2,
  },
  infoBannerBody: {
    fontSize: 12,
    lineHeight: 17,
  },
  infoBannerLink: {
    fontWeight: '700',
    fontSize: 12,
    marginTop: 8,
  },
  recentHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  viewAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  txIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  txSub: {
    fontSize: 12,
    marginTop: 2,
  },
  txAmount: {
    fontSize: 14,
    fontWeight: '700',
  },
});

import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import type { Ionicons } from '@expo/vector-icons';

import { Text, useThemeColor } from './Themed';
import { Pill } from './Pill';
import { getCustomCategories, removeTransaction, updateTransaction } from '@/lib/storage';
import { getAllCategoriesResolved, getIncomeCategoriesResolved } from '@/lib/categories';
import { CurrencyCode, CURRENCY_META, CustomCategory, Transaction, isIncome } from '@/lib/types';
import { useI18n } from '@/lib/i18n';

export function EditTransactionModal({
  transaction,
  currency,
  onClose,
  onSaved,
  onDeleted,
}: {
  transaction: Transaction | null;
  currency: CurrencyCode;
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const { t } = useI18n();
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [place, setPlace] = useState('');
  const [note, setNote] = useState('');
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const border = useThemeColor({}, 'border');
  const subtle = useThemeColor({}, 'subtle');
  const cardBg = useThemeColor({}, 'card');
  const textColor = useThemeColor({}, 'text');
  const tint = useThemeColor({}, 'tint');
  const accent = useThemeColor({}, 'accent');

  useEffect(() => {
    if (!transaction) return;
    setAmount(String(transaction.amount));
    setCategory(transaction.category);
    setPlace(transaction.place ?? '');
    setNote(transaction.note ?? '');
    setConfirmingDelete(false);
    getCustomCategories().then(setCustomCategories);
  }, [transaction]);

  if (!transaction) return null;

  // An income entry must keep choosing from income sources - offering 'cafe' here would let a
  // saved income row carry a spending category.
  const incomeMode = isIncome(transaction);
  const allCategories = incomeMode ? getIncomeCategoriesResolved(t) : getAllCategoriesResolved(customCategories, t);
  const amountNumber = Number(amount.replace(/[^0-9]/g, ''));
  const canSave = amountNumber > 0;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    await updateTransaction(transaction.id, {
      amount: amountNumber,
      category,
      place: place.trim() || undefined,
      note: note.trim() || undefined,
    });
    setSaving(false);
    onSaved();
  };

  const handleDelete = async () => {
    setDeleting(true);
    await removeTransaction(transaction.id);
    setDeleting(false);
    onDeleted();
  };

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { borderColor: border, backgroundColor: cardBg }]} onPress={(e) => e.stopPropagation()}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={styles.title}>{t('editTx.title')}</Text>

            <Text style={styles.label}>
              {t(incomeMode ? 'add.incomeAmountLabel' : 'add.amountLabel', { symbol: CURRENCY_META[currency].symbol })}
            </Text>
            <TextInput
              style={[styles.amountInput, { borderColor: border, color: textColor }]}
              keyboardType="number-pad"
              value={amount}
              onChangeText={setAmount}
            />

            <Text style={styles.label}>{t(incomeMode ? 'add.incomeCategoryLabel' : 'add.categoryLabel')}</Text>
            <View style={styles.chipRow}>
              {allCategories.map((cat) => (
                <Pill
                  key={cat.id}
                  label={cat.label}
                  icon={cat.icon as keyof typeof Ionicons.glyphMap}
                  active={category === cat.id}
                  onPress={() => setCategory(cat.id)}
                />
              ))}
            </View>

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
              {saving ? <ActivityIndicator color="white" /> : <Text style={styles.saveButtonText}>{t('common.save')}</Text>}
            </Pressable>

            {confirmingDelete ? (
              <View style={[styles.confirmBox, { borderColor: accent }]}>
                <Text style={[styles.confirmText, { color: accent }]}>{t('editTx.deleteConfirmTitle')}</Text>
                <View style={styles.confirmRow}>
                  <Pressable style={[styles.smallButton, { backgroundColor: accent }]} onPress={handleDelete} disabled={deleting}>
                    {deleting ? <ActivityIndicator color="white" /> : <Text style={styles.smallButtonTextPrimary}>{t('common.remove')}</Text>}
                  </Pressable>
                  <Pressable
                    style={[styles.smallButton, { borderColor: border, borderWidth: 1 }]}
                    onPress={() => setConfirmingDelete(false)}>
                    <Text style={{ color: subtle }}>{t('common.cancel')}</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <Pressable style={styles.deleteButton} onPress={() => setConfirmingDelete(true)}>
                <Text style={[styles.deleteButtonText, { color: accent }]}>{t('editTx.deleteButton')}</Text>
              </Pressable>
            )}

            <Pressable style={styles.cancelLink} onPress={onClose}>
              <Text style={{ color: subtle }}>{t('common.cancel')}</Text>
            </Pressable>
          </ScrollView>
        </Pressable>
      </Pressable>
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
    paddingBottom: 32,
    maxHeight: '85%',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
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
    fontSize: 24,
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
    marginTop: 20,
  },
  saveButtonText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 15,
  },
  deleteButton: {
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 6,
  },
  deleteButtonText: {
    fontWeight: '700',
    fontSize: 15,
  },
  confirmBox: {
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 14,
    marginTop: 12,
    alignItems: 'center',
  },
  confirmText: {
    fontWeight: '700',
    fontSize: 13,
    marginBottom: 10,
  },
  confirmRow: {
    flexDirection: 'row',
    gap: 10,
    alignSelf: 'stretch',
  },
  smallButton: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  smallButtonTextPrimary: {
    color: 'white',
    fontWeight: '700',
  },
  cancelLink: {
    alignItems: 'center',
    paddingVertical: 8,
  },
});

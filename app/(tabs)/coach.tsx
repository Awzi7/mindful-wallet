import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Text, useThemeColor } from '@/components/Themed';
import { Card } from '@/components/Card';
import { addCoachHistory, getActiveProvider, getCoachHistory, getCurrency } from '@/lib/storage';
import { getPurchaseAdvice, type CoachDialogueState } from '@/lib/coach';
import { EMPTY_DIALOGUE_STATE } from '@/lib/localCoach';
import { AIError } from '@/lib/ai';
import { formatMoney } from '@/lib/format';
import { CoachHistoryItem, CurrencyCode, LOCAL_COACH_ID } from '@/lib/types';
import { useI18n } from '@/lib/i18n';
import { usePremium } from '@/lib/premium';

export default function CoachScreen() {
  const { t } = useI18n();
  const { isPremium } = usePremium();
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<CoachHistoryItem[]>([]);
  const [currency, setCurrency] = useState<CurrencyCode>('USD');
  const [usingLocalCoach, setUsingLocalCoach] = useState(false);
  const [dialogueState, setDialogueState] = useState<CoachDialogueState>(EMPTY_DIALOGUE_STATE);

  const subtle = useThemeColor({}, 'subtle');
  const tint = useThemeColor({}, 'tint');
  const border = useThemeColor({}, 'border');
  const textColor = useThemeColor({}, 'text');

  useFocusEffect(
    useCallback(() => {
      getCoachHistory().then(setHistory);
      getCurrency().then(setCurrency);
      getActiveProvider().then((p) => setUsingLocalCoach(!isPremium || p === LOCAL_COACH_ID));
      // Start each visit to this tab as a fresh conversation.
      setDialogueState(EMPTY_DIALOGUE_STATE);
    }, [isPremium])
  );

  const examples = [
    t('coach.example1', { amount: formatMoney(150, currency) }),
    t('coach.example2', { amount: formatMoney(600, currency) }),
    t('coach.example3', { amount: formatMoney(30, currency) }),
  ];

  const handleAsk = async (q?: string) => {
    const text = (q ?? question).trim();
    if (!text) return;
    setLoading(true);
    setError(null);
    try {
      const { reply, state } = await getPurchaseAdvice(text, isPremium, dialogueState);
      setDialogueState(state);
      const next = await addCoachHistory(text, reply);
      setHistory(next);
      setQuestion('');
    } catch (e) {
      setError(e instanceof AIError ? e.message : t('coach.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}>
      <FlatList
        style={{ flex: 1 }}
        contentContainerStyle={styles.list}
        data={history}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View style={{ backgroundColor: 'transparent' }}>
            <Text style={[styles.intro, { color: subtle }]}>{t('coach.intro')}</Text>
            {usingLocalCoach && (
              <Text style={[styles.intro, { color: subtle, marginTop: -8 }]}>{t('coach.localCoachNotice')}</Text>
            )}
            {history.length === 0 && (
              <View style={styles.exampleRow}>
                {examples.map((ex) => (
                  <Pressable
                    key={ex}
                    style={[styles.exampleChip, { borderColor: border }]}
                    onPress={() => handleAsk(ex)}>
                    <Text style={styles.exampleText}>{ex}</Text>
                  </Pressable>
                ))}
              </View>
            )}
            {loading && (
              <Card>
                <ActivityIndicator />
              </Card>
            )}
            {error && (
              <Card>
                <Text style={{ color: subtle, fontSize: 13 }}>{error}</Text>
              </Card>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <View style={{ backgroundColor: 'transparent' }}>
            <View style={[styles.questionBubble, { backgroundColor: tint + '18' }]}>
              <Text style={styles.questionText}>{item.question}</Text>
            </View>
            <Card style={{ marginTop: 6 }}>
              <Text style={styles.answerText}>{item.answer}</Text>
            </Card>
          </View>
        )}
      />

      <View style={[styles.inputBar, { borderColor: border }]}>
        <TextInput
          style={[styles.input, { color: textColor }]}
          placeholder={t('coach.inputPlaceholder')}
          placeholderTextColor={subtle}
          value={question}
          onChangeText={setQuestion}
          onSubmitEditing={() => handleAsk()}
          returnKeyType="send"
        />
        <Pressable
          style={[styles.sendButton, { backgroundColor: question.trim() ? tint : border }]}
          onPress={() => handleAsk()}
          disabled={!question.trim() || loading}
          accessibilityRole="button"
          accessibilityLabel={t('common.send')}>
          <Ionicons name="arrow-up" size={18} color="white" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  list: {
    padding: 16,
    paddingBottom: 16,
  },
  intro: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 14,
  },
  exampleRow: {
    marginBottom: 8,
  },
  exampleChip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
  },
  exampleText: {
    fontSize: 13,
  },
  questionBubble: {
    alignSelf: 'flex-end',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 14,
    maxWidth: '85%',
  },
  questionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  answerText: {
    fontSize: 14,
    lineHeight: 21,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  input: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'rgba(128,128,128,0.12)',
    fontSize: 14,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

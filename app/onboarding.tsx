import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';

import { Text, useThemeColor } from '@/components/Themed';
import { Card } from '@/components/Card';
import { HeroCard } from '@/components/HeroCard';
import { Pill } from '@/components/Pill';
import { AvatarPicker, AVATAR_CHOICES } from '@/components/AvatarPicker';
import {
  addGoal,
  setCurrency,
  setHasOnboarded,
  setProviderConfig,
  setActiveProvider,
  setUserAvatar,
  setUserName,
} from '@/lib/storage';
import { testProviderConnection, AIError } from '@/lib/ai';
import { CURRENCIES, CURRENCY_META, CurrencyCode, PROVIDER_META, PROVIDERS, Provider } from '@/lib/types';
import { useI18n } from '@/lib/i18n';
import { LANGUAGES, LANGUAGE_FLAGS, LANGUAGE_LABELS } from '@/lib/i18n/dictionaries';

const STEPS = ['language', 'welcome', 'name', 'currency', 'goal', 'ai', 'done'] as const;
type Step = (typeof STEPS)[number];

export default function OnboardingScreen() {
  const { t, language, setLanguage } = useI18n();
  const [stepIndex, setStepIndex] = useState(0);
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState(AVATAR_CHOICES[0]);
  const [currency, setCurrencyChoice] = useState<CurrencyCode>('USD');
  const [goalName, setGoalName] = useState('');
  const [goalTarget, setGoalTarget] = useState('800');
  const [provider, setProviderChoice] = useState<Provider>('anthropic');
  const [apiKey, setApiKey] = useState('');
  const [testing, setTesting] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [keyNotice, setKeyNotice] = useState<{ tone: 'error' | 'success'; title: string; body: string } | null>(null);

  const tint = useThemeColor({}, 'tint');
  const subtle = useThemeColor({}, 'subtle');
  const border = useThemeColor({}, 'border');
  const textColor = useThemeColor({}, 'text');
  const accent = useThemeColor({}, 'accent');
  const accentSoft = useThemeColor({}, 'accentSoft');

  const step: Step = STEPS[stepIndex];

  const canGoNext =
    step === 'name'
      ? name.trim().length > 0
      : step === 'goal'
      ? goalName.trim().length > 0 && Number(goalTarget.replace(/[^0-9]/g, '')) > 0
      : true;

  const goNext = () => {
    if (!canGoNext) return;
    Haptics.selectionAsync();
    setStepIndex((i) => Math.min(STEPS.length - 1, i + 1));
  };
  const goBack = () => {
    Haptics.selectionAsync();
    setStepIndex((i) => Math.max(0, i - 1));
  };

  const handleTestKey = async () => {
    if (!apiKey.trim()) {
      setKeyNotice({ tone: 'error', title: t('onboarding.needKeyTitle'), body: t('onboarding.needKeyBody') });
      return;
    }
    setTesting(true);
    setKeyNotice(null);
    try {
      await setProviderConfig(provider, { apiKey: apiKey.trim(), model: PROVIDER_META[provider].defaultModel });
      const reply = await testProviderConnection(provider);
      setKeyNotice({
        tone: 'success',
        title: t('onboarding.connectionOkTitle'),
        body: t('onboarding.connectionOkBody', { reply: reply || '(empty)' }),
      });
    } catch (e) {
      setKeyNotice({
        tone: 'error',
        title: t('onboarding.connectionFailTitle'),
        body: e instanceof AIError ? e.message : t('common.unknownError'),
      });
    } finally {
      setTesting(false);
    }
  };

  const finish = async (dest: '/(tabs)' | '/how-it-works' = '/(tabs)') => {
    setFinishing(true);
    const target = Number(goalTarget.replace(/[^0-9]/g, '')) || 500;
    await Promise.all([
      setUserName(name.trim()),
      setUserAvatar(avatar),
      setCurrency(currency),
      addGoal({ name: goalName.trim() || t('onboarding.defaultGoalName'), targetAmount: target, savedAmount: 0 }),
      apiKey.trim()
        ? setProviderConfig(provider, { apiKey: apiKey.trim(), model: PROVIDER_META[provider].defaultModel }).then(() =>
            setActiveProvider(provider)
          )
        : Promise.resolve(),
      setHasOnboarded(),
    ]);
    router.replace(dest);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.dots}>
          {STEPS.map((s, i) => (
            <View
              key={s}
              style={[
                styles.dot,
                { backgroundColor: i <= stepIndex ? tint : border, width: i === stepIndex ? 20 : 8 },
              ]}
            />
          ))}
        </View>

        <View key={step}>
          {step === 'language' && (
            <Card>
              <Text style={styles.stepTitle}>{t('onboarding.languageStepTitle')}</Text>
              <View style={styles.pillRow}>
                {LANGUAGES.map((lang) => (
                  <Pill
                    key={lang}
                    label={`${LANGUAGE_FLAGS[lang]} ${LANGUAGE_LABELS[lang]}`.trim()}
                    active={language === lang}
                    onPress={() => setLanguage(lang)}
                  />
                ))}
              </View>
            </Card>
          )}

          {step === 'welcome' && (
            <HeroCard gradient="sunset">
              <Text style={styles.heroTitle}>{t('onboarding.welcomeTitle')}</Text>
              <Text style={styles.heroSubtitle}>{t('onboarding.welcomeSubtitle')}</Text>
            </HeroCard>
          )}

          {step === 'name' && (
            <Card>
              <Text style={styles.stepTitle}>{t('onboarding.nameStepTitle')}</Text>
              <TextInput
                style={[styles.input, { borderColor: border, color: textColor }]}
                placeholder={t('onboarding.namePlaceholder')}
                placeholderTextColor={subtle}
                value={name}
                onChangeText={setName}
                autoFocus
              />
              <Text style={[styles.label, { marginTop: 10 }]}>{t('onboarding.avatarLabel')}</Text>
              <AvatarPicker value={avatar} onChange={setAvatar} />
            </Card>
          )}

          {step === 'currency' && (
            <Card>
              <Text style={styles.stepTitle}>{t('onboarding.currencyStepTitle')}</Text>
              <View style={styles.pillRow}>
                {CURRENCIES.map((c) => (
                  <Pill
                    key={c}
                    label={`${CURRENCY_META[c].symbol} ${c}`}
                    active={currency === c}
                    onPress={() => setCurrencyChoice(c)}
                  />
                ))}
              </View>
            </Card>
          )}

          {step === 'goal' && (
            <Card>
              <Text style={styles.stepTitle}>{t('onboarding.goalStepTitle')}</Text>
              <Text style={[styles.hint, { color: subtle }]}>{t('onboarding.goalStepHint')}</Text>
              <Text style={styles.label}>{t('onboarding.goalNameLabel')}</Text>
              <TextInput
                style={[styles.input, { borderColor: border, color: textColor }]}
                placeholder={t('onboarding.defaultGoalName')}
                placeholderTextColor={subtle}
                value={goalName}
                onChangeText={setGoalName}
              />
              <Text style={styles.label}>{t('onboarding.goalAmountLabel', { symbol: CURRENCY_META[currency].symbol })}</Text>
              <TextInput
                style={[styles.input, { borderColor: border, color: textColor }]}
                keyboardType="number-pad"
                value={goalTarget}
                onChangeText={setGoalTarget}
              />
            </Card>
          )}

          {step === 'ai' && (
            <Card>
              <Text style={styles.stepTitle}>{t('onboarding.aiStepTitle')}</Text>
              <Text style={[styles.hint, { color: subtle }]}>{t('onboarding.aiStepHint')}</Text>
              <View style={styles.pillRow}>
                {PROVIDERS.map((p) => (
                  <Pill
                    key={p}
                    label={PROVIDER_META[p].shortLabel}
                    active={provider === p}
                    onPress={() => setProviderChoice(p)}
                  />
                ))}
              </View>
              <TextInput
                style={[styles.input, { borderColor: border, color: textColor, marginTop: 12 }]}
                placeholder={PROVIDER_META[provider].placeholder}
                placeholderTextColor={subtle}
                value={apiKey}
                onChangeText={setApiKey}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
              />
              <Pressable style={[styles.testButton, { borderColor: tint }]} onPress={handleTestKey} disabled={testing}>
                {testing ? <ActivityIndicator color={tint} /> : <Text style={{ color: tint, fontWeight: '700' }}>{t('onboarding.testConnection')}</Text>}
              </Pressable>
              {keyNotice && (
                <View
                  style={[
                    styles.infoBanner,
                    { borderColor: keyNotice.tone === 'success' ? tint : accent, backgroundColor: accentSoft },
                  ]}>
                  <View style={styles.infoBannerContent}>
                    <Text style={[styles.infoBannerTitle, { color: keyNotice.tone === 'success' ? tint : accent }]}>
                      {keyNotice.title}
                    </Text>
                    <Text style={[styles.infoBannerBody, { color: subtle }]}>{keyNotice.body}</Text>
                  </View>
                  <Pressable
                    onPress={() => setKeyNotice(null)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={t('common.close')}>
                    <Ionicons name="close" size={16} color={subtle} />
                  </Pressable>
                </View>
              )}
            </Card>
          )}

          {step === 'done' && (
            <HeroCard gradient="lagoon">
              <Text style={styles.heroTitle}>{t('onboarding.doneTitle', { name: name.trim() || t('common.friend') })}</Text>
              <Text style={styles.heroSubtitle}>{t('onboarding.doneSubtitle')}</Text>
            </HeroCard>
          )}
        </View>

        <View style={styles.navRow}>
          {stepIndex > 0 && step !== 'done' && (
            <Pressable style={[styles.navButton, { borderColor: border, borderWidth: 1 }]} onPress={goBack}>
              <Text style={{ color: subtle, fontWeight: '600' }}>{t('common.back')}</Text>
            </Pressable>
          )}
          {step !== 'done' ? (
            <Pressable
              style={[styles.navButton, styles.navButtonPrimary, { backgroundColor: canGoNext ? tint : border }]}
              onPress={goNext}
              disabled={!canGoNext}>
              <Text style={styles.navButtonTextPrimary}>{step === 'ai' ? t('common.next') : t('common.continue')}</Text>
            </Pressable>
          ) : (
            <Pressable
              style={[styles.navButton, styles.navButtonPrimary, { backgroundColor: tint }]}
              onPress={() => finish()}
              disabled={finishing}>
              {finishing ? <ActivityIndicator color="white" /> : <Text style={styles.navButtonTextPrimary}>{t('onboarding.startUsing')}</Text>}
            </Pressable>
          )}
        </View>

        {step === 'ai' && (
          <Pressable style={styles.skipLink} onPress={goNext}>
            <Text style={{ color: subtle, fontSize: 13 }}>{t('common.skip')}</Text>
          </Pressable>
        )}

        {step === 'done' && (
          <Pressable style={styles.skipLink} onPress={() => finish('/how-it-works')} disabled={finishing}>
            <Text style={{ color: subtle, fontSize: 13 }}>{t('howItWorks.onboardingLink')}</Text>
          </Pressable>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    padding: 20,
    justifyContent: 'center',
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 24,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: 'white',
    marginBottom: 10,
  },
  heroSubtitle: {
    fontSize: 14,
    lineHeight: 21,
    color: 'rgba(255,255,255,0.9)',
  },
  stepTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  hint: {
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 14,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
    marginTop: 6,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 8,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  testButton: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  navRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 24,
  },
  navButton: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  navButtonPrimary: {},
  navButtonTextPrimary: {
    color: 'white',
    fontWeight: '700',
    fontSize: 15,
  },
  skipLink: {
    alignSelf: 'center',
    marginTop: 14,
    padding: 8,
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
});

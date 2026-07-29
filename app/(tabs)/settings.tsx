import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import * as LocalAuthentication from 'expo-local-authentication';

import { Text, useThemeColor } from '@/components/Themed';
import { Card } from '@/components/Card';
import { Pill } from '@/components/Pill';
import { AvatarPicker } from '@/components/AvatarPicker';
import {
  exportAllData,
  getActiveProvider,
  getAppLockEnabled,
  getCurrency,
  getProviderSettings,
  getUserAvatar,
  getUserName,
  importAllData,
  resetAllData,
  setActiveProvider,
  setAppLockEnabled,
  setCurrency,
  setProviderConfig,
  setUserAvatar,
  setUserName,
} from '@/lib/storage';
import { testProviderConnection, AIError } from '@/lib/ai';
import { PRIVACY_POLICY_URL, TERMS_OF_USE_URL, openLegalUrl } from '@/lib/legal';
import {
  ActiveAIOption,
  CURRENCIES,
  CURRENCY_META,
  CurrencyCode,
  LOCAL_COACH_ID,
  PROVIDER_META,
  PROVIDERS,
  Provider,
  ProviderSettings,
} from '@/lib/types';
import { useI18n } from '@/lib/i18n';
import { LANGUAGES, LANGUAGE_FLAGS, LANGUAGE_LABELS } from '@/lib/i18n/dictionaries';
import { useThemePreference } from '@/lib/theme';
import { ThemePreference } from '@/lib/storage';
import { usePremium } from '@/lib/premium';

const THEME_OPTIONS: { value: ThemePreference; labelKey: string }[] = [
  { value: 'system', labelKey: 'settings.themeSystem' },
  { value: 'light', labelKey: 'settings.themeLight' },
  { value: 'dark', labelKey: 'settings.themeDark' },
];

export default function SettingsScreen() {
  const { t, language, setLanguage } = useI18n();
  const { preference: themePreference, setPreference: setThemePreference } = useThemePreference();
  const { isPremium, reset: resetPremium } = usePremium();
  const [activeProvider, setActiveProviderState] = useState<ActiveAIOption>(LOCAL_COACH_ID);
  const [expandedProvider, setExpandedProvider] = useState<Provider | null>(null);
  const [drafts, setDrafts] = useState<ProviderSettings | null>(null);
  const [testing, setTesting] = useState<Provider | null>(null);
  const [testNotice, setTestNotice] = useState<{
    provider: Provider;
    tone: 'error' | 'success';
    title: string;
    body: string;
  } | null>(null);
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState('');
  const [currency, setCurrencyState] = useState<CurrencyCode>('USD');
  const [saved, setSaved] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [pendingImportJson, setPendingImportJson] = useState<string | null>(null);
  const [backupNotice, setBackupNotice] = useState<{ tone: 'error' | 'success'; title: string; body: string } | null>(null);
  const [pendingReset, setPendingReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [appLockEnabled, setAppLockEnabledState] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);

  const border = useThemeColor({}, 'border');
  const subtle = useThemeColor({}, 'subtle');
  const textColor = useThemeColor({}, 'text');
  const tint = useThemeColor({}, 'tint');
  const accent = useThemeColor({}, 'accent');
  const accentSoft = useThemeColor({}, 'accentSoft');

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const [active, providerSettings, n, a, curr, lockEnabled] = await Promise.all([
          getActiveProvider(),
          getProviderSettings(),
          getUserName(),
          getUserAvatar(),
          getCurrency(),
          getAppLockEnabled(),
        ]);
        setActiveProviderState(active);
        setExpandedProvider((prev) => prev ?? (active === LOCAL_COACH_ID ? null : active));
        setDrafts(providerSettings);
        setName(n);
        setAvatar(a);
        setCurrencyState(curr);
        setAppLockEnabledState(lockEnabled);

        if (Platform.OS !== 'web') {
          const [hasHardware, isEnrolled] = await Promise.all([
            LocalAuthentication.hasHardwareAsync(),
            LocalAuthentication.isEnrolledAsync(),
          ]);
          setBiometricAvailable(hasHardware && isEnrolled);
        }
      })();
    }, [])
  );

  const handleToggleAppLock = async (value: boolean) => {
    if (value) {
      // Verify biometrics actually work before turning the lock on, so a misconfigured device
      // can't lock the user out of their own data.
      const result = await LocalAuthentication.authenticateAsync({ promptMessage: t('appLock.confirmPrompt') });
      if (!result.success) return;
    }
    await setAppLockEnabled(value);
    setAppLockEnabledState(value);
  };

  const updateDraft = (provider: Provider, patch: Partial<ProviderSettings[Provider]>) => {
    setDrafts((prev) => (prev ? { ...prev, [provider]: { ...prev[provider], ...patch } } : prev));
  };

  const handleSave = async () => {
    if (!drafts) return;
    await Promise.all([
      ...PROVIDERS.map((p) => setProviderConfig(p, drafts[p])),
      setActiveProvider(activeProvider),
      setUserName(name),
      setUserAvatar(avatar),
      setCurrency(currency),
    ]);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleTest = async (provider: Provider) => {
    if (!drafts) return;
    const cfg = drafts[provider];
    if (!cfg.apiKey.trim()) {
      setTestNotice({
        provider,
        tone: 'error',
        title: t('settings.needKeyTitle'),
        body: t('settings.needKeyBody', { provider: t(PROVIDER_META[provider].labelKey) }),
      });
      return;
    }
    setTesting(provider);
    setTestNotice(null);
    try {
      await setProviderConfig(provider, cfg);
      const reply = await testProviderConnection(provider);
      setTestNotice({
        provider,
        tone: 'success',
        title: t('settings.connectionOkTitle'),
        body: t('settings.connectionOkBody', { reply: reply || '(empty)' }),
      });
    } catch (e) {
      const msg = e instanceof AIError ? e.message : t('common.unknownError');
      setTestNotice({ provider, tone: 'error', title: t('settings.connectionFailTitle'), body: msg });
    } finally {
      setTesting(null);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    setBackupNotice(null);
    try {
      const json = await exportAllData();
      if (Platform.OS === 'web') {
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'mindful-wallet-backup.json';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else {
        const file = new File(Paths.cache, 'mindful-wallet-backup.json');
        if (file.exists) file.delete();
        file.create();
        file.write(json);
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: t('settings.exportButton') });
        }
      }
      setBackupNotice({ tone: 'success', title: t('settings.exportSuccessTitle'), body: t('settings.exportSuccessBody') });
    } catch {
      setBackupNotice({ tone: 'error', title: t('settings.exportErrorTitle'), body: t('settings.exportErrorBody') });
    } finally {
      setExporting(false);
    }
  };

  const handlePickImport = async () => {
    setBackupNotice(null);
    const result = await DocumentPicker.getDocumentAsync({ type: 'application/json', copyToCacheDirectory: true });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    try {
      const json =
        Platform.OS === 'web'
          ? asset.file
            ? await asset.file.text()
            : await (await fetch(asset.uri)).text()
          : await new File(asset.uri).text();
      setPendingImportJson(json);
    } catch {
      setBackupNotice({ tone: 'error', title: t('settings.importErrorTitle'), body: t('settings.importErrorBody') });
    }
  };

  const handleConfirmImport = async () => {
    if (!pendingImportJson) return;
    setImporting(true);
    try {
      await importAllData(pendingImportJson);
      setBackupNotice({ tone: 'success', title: t('settings.importSuccessTitle'), body: t('settings.importSuccessBody') });
    } catch {
      setBackupNotice({ tone: 'error', title: t('settings.importErrorTitle'), body: t('settings.importErrorBody') });
    } finally {
      setPendingImportJson(null);
      setImporting(false);
    }
  };

  const handleConfirmReset = async () => {
    setResetting(true);
    try {
      await resetAllData();
      await resetPremium();
      router.replace('/onboarding');
    } finally {
      setPendingReset(false);
      setResetting(false);
    }
  };

  if (!drafts) return null;

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Pressable
        disabled={isPremium}
        onPress={() => router.push('/paywall')}
        style={[styles.premiumBanner, { borderColor: isPremium ? '#C9932F' : border, backgroundColor: isPremium ? '#C9932F18' : accentSoft }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.premiumBannerTitle, { color: isPremium ? '#C9932F' : accent }]}>
            {isPremium ? t('premium.statusPremiumLine') : t('premium.badgePremium')}
          </Text>
          <Text style={[styles.smallText, { color: subtle, marginTop: 2 }]}>
            {isPremium ? t('premium.alreadyPremiumBody') : t('premium.paywallSubtitle')}
          </Text>
        </View>
        {!isPremium && (
          <View style={[styles.upgradePill, { backgroundColor: accent }]}>
            <Text style={styles.upgradePillText}>{t('premium.upgradeLink')}</Text>
          </View>
        )}
      </Pressable>
      {isPremium && __DEV__ && (
        <Pressable onPress={resetPremium} style={{ alignSelf: 'flex-start', marginBottom: 16, marginTop: -6 }}>
          <Text style={{ color: subtle, fontSize: 12 }}>{t('premium.resetButton')}</Text>
        </Pressable>
      )}

      <Text style={[styles.groupTitle, { color: subtle }]}>{t('settings.aiProviders')}</Text>
      <Text style={[styles.hint, { color: subtle, marginBottom: 14 }]}>{t('settings.aiProvidersHint')}</Text>

      <Card style={activeProvider === LOCAL_COACH_ID ? { borderColor: tint, borderWidth: 1.5 } : undefined}>
        <View style={styles.providerHeader}>
          <Text style={styles.sectionTitle}>{t('settings.providersLocalLabel')}</Text>
          {activeProvider === LOCAL_COACH_ID ? (
            <View style={[styles.activeBadge, { backgroundColor: accentSoft }]}>
              <Text style={[styles.activeBadgeText, { color: accent }]}>{t('settings.active')}</Text>
            </View>
          ) : (
            <Pressable onPress={() => setActiveProviderState(LOCAL_COACH_ID)}>
              <Text style={{ color: tint, fontSize: 12, fontWeight: '600' }}>{t('settings.makeActive')}</Text>
            </Pressable>
          )}
        </View>
        <Text style={[styles.hint, { color: subtle, marginTop: 8 }]}>{t('settings.providersLocalHint')}</Text>
      </Card>

      {PROVIDERS.map((provider) => {
        const meta = PROVIDER_META[provider];
        const cfg = drafts[provider];
        const isActive = activeProvider === provider;
        const isExpanded = expandedProvider === provider;

        return (
          <Card key={provider} style={isActive ? { borderColor: tint, borderWidth: 1.5 } : undefined}>
            <View style={[styles.providerHeader, isExpanded && styles.providerHeaderExpanded]}>
              <Pressable
                style={styles.providerHeaderToggle}
                onPress={() => setExpandedProvider(isExpanded ? null : provider)}
                accessibilityRole="button"
                accessibilityState={{ expanded: isExpanded }}>
                <Text style={styles.sectionTitle}>{t(meta.labelKey)}</Text>
                <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={16} color={subtle} />
              </Pressable>
              {isActive ? (
                <View style={[styles.activeBadge, { backgroundColor: accentSoft }]}>
                  <Text style={[styles.activeBadgeText, { color: accent }]}>{t('settings.active')}</Text>
                </View>
              ) : isPremium ? (
                <Pressable onPress={() => setActiveProviderState(provider)}>
                  <Text style={{ color: tint, fontSize: 12, fontWeight: '600' }}>{t('settings.makeActive')}</Text>
                </Pressable>
              ) : (
                <Pressable style={styles.premiumLockBadge} onPress={() => router.push('/paywall')}>
                  <Ionicons name="lock-closed" size={11} color={accent} />
                  <Text style={{ color: accent, fontSize: 12, fontWeight: '600' }}>{t('settings.premiumRequired')}</Text>
                </Pressable>
              )}
            </View>

            {isExpanded && (
              <>
                <TextInput
                  style={[styles.input, { borderColor: border, color: textColor }]}
                  placeholder={meta.placeholder}
                  placeholderTextColor={subtle}
                  value={cfg.apiKey}
                  onChangeText={(v) => updateDraft(provider, { apiKey: v })}
                  autoCapitalize="none"
                  autoCorrect={false}
                  secureTextEntry
                />
                <Text style={[styles.label, { color: subtle }]}>{t('settings.modelLabel')}</Text>
                <TextInput
                  style={[styles.input, { borderColor: border, color: textColor }]}
                  placeholder={meta.defaultModel}
                  placeholderTextColor={subtle}
                  value={cfg.model}
                  onChangeText={(v) => updateDraft(provider, { model: v })}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <View style={styles.providerFooter}>
                  <Text style={[styles.smallText, { color: subtle }]}>{t('settings.keyHint', { url: meta.helpUrl })}</Text>
                  <Pressable
                    style={[styles.testButton, { backgroundColor: accentSoft }]}
                    onPress={() => handleTest(provider)}
                    disabled={testing === provider}>
                    {testing === provider ? (
                      <ActivityIndicator size="small" color={accent} />
                    ) : (
                      <Text style={[styles.testButtonText, { color: accent }]}>{t('settings.testConnection')}</Text>
                    )}
                  </Pressable>
                </View>
                {testNotice?.provider === provider && (
                  <View
                    style={[
                      styles.infoBanner,
                      { borderColor: testNotice.tone === 'success' ? tint : accent, backgroundColor: accentSoft },
                    ]}>
                    <View style={styles.infoBannerContent}>
                      <Text style={[styles.infoBannerTitle, { color: testNotice.tone === 'success' ? tint : accent }]}>
                        {testNotice.title}
                      </Text>
                      <Text style={[styles.infoBannerBody, { color: subtle }]}>{testNotice.body}</Text>
                    </View>
                    <Pressable
                      onPress={() => setTestNotice(null)}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={t('common.close')}>
                      <Ionicons name="close" size={16} color={subtle} />
                    </Pressable>
                  </View>
                )}
              </>
            )}
          </Card>
        );
      })}

      <Text style={[styles.groupTitle, { color: subtle, marginTop: 8 }]}>{t('settings.general')}</Text>
      <Card>
        <Text style={[styles.label, { color: subtle }]}>{t('settings.nameLabel')}</Text>
        <TextInput
          style={[styles.input, { borderColor: border, color: textColor }]}
          placeholder={t('settings.namePlaceholder')}
          placeholderTextColor={subtle}
          value={name}
          onChangeText={setName}
        />

        <Text style={[styles.label, { color: subtle, marginTop: 14 }]}>{t('settings.avatarLabel')}</Text>
        <AvatarPicker value={avatar} onChange={setAvatar} />

        <Text style={[styles.label, { color: subtle, marginTop: 14 }]}>{t('settings.appearance')}</Text>
        <View style={styles.currencyRow}>
          {THEME_OPTIONS.map(({ value, labelKey }) => (
            <Pill key={value} label={t(labelKey)} active={themePreference === value} onPress={() => setThemePreference(value)} />
          ))}
        </View>

        <Text style={[styles.label, { color: subtle, marginTop: 14 }]}>{t('settings.language')}</Text>
        <View style={styles.currencyRow}>
          {LANGUAGES.map((lang) => (
            <Pill
              key={lang}
              label={`${LANGUAGE_FLAGS[lang]} ${LANGUAGE_LABELS[lang]}`.trim()}
              active={language === lang}
              onPress={() => setLanguage(lang)}
            />
          ))}
        </View>

        <Text style={[styles.label, { color: subtle, marginTop: 14 }]}>{t('settings.currency')}</Text>
        <View style={styles.currencyRow}>
          {CURRENCIES.map((c) => (
            <Pill
              key={c}
              label={`${CURRENCY_META[c].symbol} ${c}`}
              active={currency === c}
              onPress={() => setCurrencyState(c)}
            />
          ))}
        </View>
      </Card>

      <Text style={[styles.groupTitle, { color: subtle }]}>{t('settings.dataBackup')}</Text>
      <Card>
        <Text style={[styles.hint, { color: subtle, marginBottom: 14 }]}>{t('settings.dataBackupHint')}</Text>
        <View style={styles.editRow}>
          <Pressable
            style={[styles.smallButton, { backgroundColor: accentSoft }]}
            onPress={handleExport}
            disabled={exporting}>
            {exporting ? (
              <ActivityIndicator size="small" color={accent} />
            ) : (
              <Text style={{ color: accent, fontWeight: '700' }}>{t('settings.exportButton')}</Text>
            )}
          </Pressable>
          <Pressable
            style={[styles.smallButton, { borderColor: border, borderWidth: 1 }]}
            onPress={handlePickImport}
            disabled={importing}>
            <Text style={{ color: subtle, fontWeight: '700' }}>{t('settings.importButton')}</Text>
          </Pressable>
        </View>

        {pendingImportJson && (
          <View style={[styles.confirmBox, { borderColor: accent }]}>
            <Text style={[styles.confirmTitle, { color: accent }]}>{t('settings.importConfirmTitle')}</Text>
            <Text style={[styles.smallText, { color: subtle, marginTop: 4, marginBottom: 10 }]}>
              {t('settings.importConfirmBody')}
            </Text>
            <View style={styles.editRow}>
              <Pressable style={[styles.smallButton, { backgroundColor: accent }]} onPress={handleConfirmImport} disabled={importing}>
                {importing ? <ActivityIndicator size="small" color="white" /> : <Text style={{ color: 'white', fontWeight: '700' }}>{t('common.confirm')}</Text>}
              </Pressable>
              <Pressable
                style={[styles.smallButton, { borderColor: border, borderWidth: 1 }]}
                onPress={() => setPendingImportJson(null)}
                disabled={importing}>
                <Text style={{ color: subtle }}>{t('common.cancel')}</Text>
              </Pressable>
            </View>
          </View>
        )}

        {backupNotice && (
          <View
            style={[
              styles.infoBanner,
              { borderColor: backupNotice.tone === 'success' ? tint : accent, backgroundColor: accentSoft, marginTop: 14 },
            ]}>
            <View style={styles.infoBannerContent}>
              <Text style={[styles.infoBannerTitle, { color: backupNotice.tone === 'success' ? tint : accent }]}>
                {backupNotice.title}
              </Text>
              <Text style={[styles.infoBannerBody, { color: subtle }]}>{backupNotice.body}</Text>
            </View>
            <Pressable
              onPress={() => setBackupNotice(null)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}>
              <Ionicons name="close" size={16} color={subtle} />
            </Pressable>
          </View>
        )}
      </Card>

      {Platform.OS !== 'web' && (
        <>
          <Text style={[styles.groupTitle, { color: subtle }]}>{t('settings.appLock')}</Text>
          <Card>
            <View style={styles.appLockRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionTitle}>{t('settings.appLock')}</Text>
                <Text style={[styles.hint, { color: subtle, marginTop: 4, marginBottom: 0 }]}>
                  {biometricAvailable ? t('settings.appLockHint') : t('settings.appLockUnavailable')}
                </Text>
              </View>
              <Switch
                value={appLockEnabled}
                onValueChange={handleToggleAppLock}
                disabled={!biometricAvailable}
                trackColor={{ true: tint }}
              />
            </View>
          </Card>
        </>
      )}

      <Text style={[styles.groupTitle, { color: subtle }]}>{t('settings.privacy')}</Text>
      <Card>
        <Text style={[styles.hint, { color: subtle }]}>{t('settings.privacyText')}</Text>
        <View style={styles.legalLinks}>
          <Pressable onPress={() => openLegalUrl(PRIVACY_POLICY_URL)} hitSlop={6} accessibilityRole="link">
            <Text style={[styles.legalLinkText, { color: tint }]}>{t('premium.privacyLink')}</Text>
          </Pressable>
          <Text style={{ color: subtle }}>·</Text>
          <Pressable onPress={() => openLegalUrl(TERMS_OF_USE_URL)} hitSlop={6} accessibilityRole="link">
            <Text style={[styles.legalLinkText, { color: tint }]}>{t('premium.termsLink')}</Text>
          </Pressable>
        </View>
      </Card>

      <Text style={[styles.groupTitle, { color: subtle }]}>{t('settings.resetData')}</Text>
      <Card>
        <Text style={[styles.hint, { color: subtle, marginBottom: 14 }]}>{t('settings.resetDataHint')}</Text>
        {!pendingReset ? (
          <Pressable
            style={[styles.smallButton, { borderColor: accent, borderWidth: 1 }]}
            onPress={() => setPendingReset(true)}>
            <Text style={{ color: accent, fontWeight: '700' }}>{t('settings.resetButton')}</Text>
          </Pressable>
        ) : (
          <View style={[styles.confirmBox, { borderColor: accent }]}>
            <Text style={[styles.confirmTitle, { color: accent }]}>{t('settings.resetConfirmTitle')}</Text>
            <Text style={[styles.smallText, { color: subtle, marginTop: 4, marginBottom: 10 }]}>
              {t('settings.resetConfirmBody')}
            </Text>
            <View style={styles.editRow}>
              <Pressable style={[styles.smallButton, { backgroundColor: accent }]} onPress={handleConfirmReset} disabled={resetting}>
                {resetting ? <ActivityIndicator size="small" color="white" /> : <Text style={{ color: 'white', fontWeight: '700' }}>{t('common.confirm')}</Text>}
              </Pressable>
              <Pressable
                style={[styles.smallButton, { borderColor: border, borderWidth: 1 }]}
                onPress={() => setPendingReset(false)}
                disabled={resetting}>
                <Text style={{ color: subtle }}>{t('common.cancel')}</Text>
              </Pressable>
            </View>
          </View>
        )}
      </Card>

      <Pressable style={[styles.saveButton, { backgroundColor: tint }]} onPress={handleSave}>
        <Text style={styles.saveButtonText}>{saved ? t('settings.saved') : t('settings.save')}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    padding: 16,
    paddingBottom: 48,
  },
  premiumBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    gap: 12,
  },
  premiumBannerTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  upgradePill: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  upgradePillText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 12,
  },
  legalLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  legalLinkText: {
    fontSize: 13,
    fontWeight: '600',
  },
  groupTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  providerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  appLockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  providerHeaderExpanded: {
    marginBottom: 12,
  },
  providerHeaderToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  activeBadge: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  activeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  premiumLockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  hint: {
    fontSize: 12,
    lineHeight: 18,
  },
  label: {
    fontSize: 12,
    marginBottom: 6,
    marginTop: 6,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: Platform.select({ ios: 12, default: 8 }),
    fontSize: 15,
    marginBottom: 4,
  },
  currencyRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  providerFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  smallText: {
    fontSize: 11,
  },
  testButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  testButtonText: {
    fontWeight: '700',
    fontSize: 12,
  },
  editRow: {
    flexDirection: 'row',
    gap: 10,
  },
  smallButton: {
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  confirmBox: {
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 14,
    marginTop: 14,
  },
  confirmTitle: {
    fontWeight: '700',
    fontSize: 13,
  },
  saveButton: {
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 6,
  },
  saveButtonText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 15,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
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
});

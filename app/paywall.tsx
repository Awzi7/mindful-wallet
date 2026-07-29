import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text, useThemeColor } from '@/components/Themed';
import { Card } from '@/components/Card';
import { HeroCard } from '@/components/HeroCard';
import { usePremium, FREE_CUSTOM_CATEGORY_LIMIT } from '@/lib/premium';
import type { PurchasesPackage } from '@/lib/iap';
import { useI18n } from '@/lib/i18n';
import { PRIVACY_POLICY_URL, TERMS_OF_USE_URL, openLegalUrl } from '@/lib/legal';

const FEATURES: { icon: keyof typeof Ionicons.glyphMap; titleKey: string; descKey: string; vars?: Record<string, number> }[] = [
  { icon: 'pricetags-outline', titleKey: 'premium.featureCategoriesTitle', descKey: 'premium.featureCategoriesDesc', vars: { limit: FREE_CUSTOM_CATEGORY_LIMIT } },
  { icon: 'sparkles-outline', titleKey: 'premium.featureCoachTitle', descKey: 'premium.featureCoachDesc' },
  { icon: 'calendar-outline', titleKey: 'premium.featureHistoryTitle', descKey: 'premium.featureHistoryDesc' },
  { icon: 'star-outline', titleKey: 'premium.featureThemeTitle', descKey: 'premium.featureThemeDesc' },
];

function packageLabel(pkg: PurchasesPackage, t: (key: string) => string): string {
  if (pkg.packageType === 'ANNUAL') return t('premium.yearlyLabel');
  if (pkg.packageType === 'MONTHLY') return t('premium.monthlyLabel');
  return pkg.product.title;
}

export default function PaywallScreen() {
  const { t } = useI18n();
  const { isPremium, unlock, restore, reset, iapAvailable, offering } = usePremium();
  const [plan, setPlan] = useState<'monthly' | 'yearly'>('yearly');
  const [selectedPackage, setSelectedPackage] = useState<PurchasesPackage | null>(null);
  const [unlocking, setUnlocking] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [justUnlocked, setJustUnlocked] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'error' | 'success'; title: string; body: string } | null>(null);

  const subtle = useThemeColor({}, 'subtle');
  const border = useThemeColor({}, 'border');
  const tint = useThemeColor({}, 'tint');
  const accentSoft = useThemeColor({}, 'accentSoft');
  const accent = useThemeColor({}, 'accent');
  const insets = useSafeAreaInsets();

  const packages = offering?.availablePackages ?? [];
  const hasRealPackages = iapAvailable && packages.length > 0;

  useEffect(() => {
    if (!hasRealPackages) return;
    setSelectedPackage((prev) =>
      prev ?? packages.find((p) => p.packageType === 'ANNUAL') ?? packages.find((p) => p.packageType === 'MONTHLY') ?? packages[0]
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasRealPackages, packages.length]);

  const handleUnlock = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setNotice(null);
    if (hasRealPackages && !selectedPackage) {
      setNotice({ tone: 'error', title: t('premium.noOfferingTitle'), body: t('premium.noOfferingBody') });
      return;
    }
    setUnlocking(true);
    try {
      await unlock(hasRealPackages ? selectedPackage! : undefined);
      setJustUnlocked(true);
    } catch (e) {
      if (!(e as { userCancelled?: boolean } | null)?.userCancelled) {
        setNotice({ tone: 'error', title: t('premium.purchaseErrorTitle'), body: t('premium.purchaseErrorBody') });
      }
    } finally {
      setUnlocking(false);
    }
  };

  const handleRestore = async () => {
    setNotice(null);
    setRestoring(true);
    try {
      const restored = await restore();
      if (restored) {
        setJustUnlocked(true);
        setNotice({ tone: 'success', title: t('premium.restoreSuccessTitle'), body: t('premium.restoreSuccessBody') });
      } else {
        setNotice({ tone: 'error', title: t('premium.restoreNothingTitle'), body: t('premium.restoreNothingBody') });
      }
    } catch {
      setNotice({ tone: 'error', title: t('premium.restoreErrorTitle'), body: t('premium.restoreErrorBody') });
    } finally {
      setRestoring(false);
    }
  };

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

        <HeroCard gradient="gold" style={{ marginTop: insets.top + 36 }}>
          <Text style={styles.heroTitle}>{t('premium.paywallTitle')}</Text>
          <Text style={styles.heroSubtitle}>{t('premium.paywallSubtitle')}</Text>
        </HeroCard>

        {isPremium || justUnlocked ? (
          <Card style={{ alignItems: 'center', paddingVertical: 28 }}>
            <Text style={{ fontSize: 34, marginBottom: 8 }}>🎉</Text>
            <Text style={[styles.cardTitle, { textAlign: 'center' }]}>{t('premium.alreadyPremiumTitle')}</Text>
            <Text style={[styles.bodyText, { color: subtle, textAlign: 'center', marginTop: 6 }]}>
              {t('premium.alreadyPremiumBody')}
            </Text>
            <Pressable style={[styles.primaryButton, { backgroundColor: tint, marginTop: 20, alignSelf: 'stretch' }]} onPress={close}>
              <Text style={styles.primaryButtonText}>{t('common.continue')}</Text>
            </Pressable>
            {__DEV__ && (
              <Pressable onPress={reset} style={{ marginTop: 14 }}>
                <Text style={{ color: subtle, fontSize: 12 }}>{t('premium.resetButton')}</Text>
              </Pressable>
            )}
          </Card>
        ) : (
          <>
            {FEATURES.map((f) => (
              <Card key={f.titleKey} style={styles.featureRow}>
                <View style={[styles.featureIcon, { backgroundColor: accentSoft }]}>
                  <Ionicons name={f.icon} size={20} color={accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.featureTitle}>{t(f.titleKey)}</Text>
                  <Text style={[styles.featureDesc, { color: subtle }]}>{t(f.descKey, f.vars)}</Text>
                </View>
              </Card>
            ))}

            <View style={styles.planRow}>
              {hasRealPackages ? (
                packages.map((pkg) => (
                  <Pressable
                    key={pkg.identifier}
                    style={[styles.planCard, { borderColor: selectedPackage?.identifier === pkg.identifier ? tint : border }]}
                    onPress={() => setSelectedPackage(pkg)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selectedPackage?.identifier === pkg.identifier }}
                    accessibilityLabel={`${packageLabel(pkg, t)} ${pkg.product.priceString}`}>
                    {pkg.packageType === 'ANNUAL' && (
                      <View style={[styles.saveBadge, { backgroundColor: accentSoft }]}>
                        <Text style={[styles.saveBadgeText, { color: accent }]}>{t('premium.yearlySave')}</Text>
                      </View>
                    )}
                    <Text style={styles.planLabel}>{packageLabel(pkg, t)}</Text>
                    <Text style={styles.planPrice}>{pkg.product.priceString}</Text>
                  </Pressable>
                ))
              ) : (
                <>
                  <Pressable
                    style={[styles.planCard, { borderColor: plan === 'monthly' ? tint : border }]}
                    onPress={() => setPlan('monthly')}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: plan === 'monthly' }}
                    accessibilityLabel={`${t('premium.monthlyLabel')} ${t('premium.monthlyPrice')}${t('premium.perMonth')}`}>
                    <Text style={styles.planLabel}>{t('premium.monthlyLabel')}</Text>
                    <Text style={styles.planPrice}>
                      {t('premium.monthlyPrice')}
                      <Text style={[styles.planPriceSuffix, { color: subtle }]}>{t('premium.perMonth')}</Text>
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.planCard, { borderColor: plan === 'yearly' ? tint : border }]}
                    onPress={() => setPlan('yearly')}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: plan === 'yearly' }}
                    accessibilityLabel={`${t('premium.yearlyLabel')} ${t('premium.yearlyPrice')}${t('premium.perYear')}, ${t('premium.yearlySave')}`}>
                    <View style={[styles.saveBadge, { backgroundColor: accentSoft }]}>
                      <Text style={[styles.saveBadgeText, { color: accent }]}>{t('premium.yearlySave')}</Text>
                    </View>
                    <Text style={styles.planLabel}>{t('premium.yearlyLabel')}</Text>
                    <Text style={styles.planPrice}>
                      {t('premium.yearlyPrice')}
                      <Text style={[styles.planPriceSuffix, { color: subtle }]}>{t('premium.perYear')}</Text>
                    </Text>
                  </Pressable>
                </>
              )}
            </View>

            <Pressable
              style={[styles.primaryButton, { backgroundColor: tint }]}
              onPress={handleUnlock}
              disabled={unlocking || (hasRealPackages && !selectedPackage)}>
              {unlocking ? <ActivityIndicator color="white" /> : <Text style={styles.primaryButtonText}>{t('premium.unlockButton')}</Text>}
            </Pressable>
            {!hasRealPackages && <Text style={[styles.testNote, { color: subtle }]}>{t('premium.testModeNote')}</Text>}

            {notice && (
              <View
                style={[
                  styles.infoBanner,
                  { borderColor: notice.tone === 'success' ? tint : accent, backgroundColor: accentSoft },
                ]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.infoBannerTitle, { color: notice.tone === 'success' ? tint : accent }]}>{notice.title}</Text>
                  <Text style={[styles.infoBannerBody, { color: subtle }]}>{notice.body}</Text>
                </View>
                <Pressable onPress={() => setNotice(null)} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('common.close')}>
                  <Ionicons name="close" size={16} color={subtle} />
                </Pressable>
              </View>
            )}

            {iapAvailable && (
              <Pressable style={styles.laterLink} onPress={handleRestore} disabled={restoring}>
                {restoring ? (
                  <ActivityIndicator size="small" color={subtle} />
                ) : (
                  <Text style={{ color: tint, fontWeight: '600' }}>{t('premium.restoreLink')}</Text>
                )}
              </Pressable>
            )}

            <Pressable style={styles.laterLink} onPress={close}>
              <Text style={{ color: subtle }}>{t('premium.continueFree')}</Text>
            </Pressable>

            {/* Required by App Store Guideline 3.1.2: auto-renewal terms plus links to
                the Terms of Use and Privacy Policy, on the purchase screen itself. */}
            <Text style={[styles.legalNote, { color: subtle }]}>{t('premium.autoRenewNote')}</Text>
            <View style={styles.legalLinks}>
              <Pressable onPress={() => openLegalUrl(TERMS_OF_USE_URL)} hitSlop={6} accessibilityRole="link">
                <Text style={[styles.legalLinkText, { color: tint }]}>{t('premium.termsLink')}</Text>
              </Pressable>
              <Text style={{ color: subtle }}>·</Text>
              <Pressable onPress={() => openLegalUrl(PRIVACY_POLICY_URL)} hitSlop={6} accessibilityRole="link">
                <Text style={[styles.legalLinkText, { color: tint }]}>{t('premium.privacyLink')}</Text>
              </Pressable>
            </View>
          </>
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
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  bodyText: {
    fontSize: 14,
    lineHeight: 20,
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
  planRow: {
    flexDirection: 'row',
    gap: 12,
    marginVertical: 8,
  },
  planCard: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  saveBadge: {
    position: 'absolute',
    top: -10,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  saveBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  planLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  planPrice: {
    fontSize: 18,
    fontWeight: '700',
  },
  planPriceSuffix: {
    fontSize: 12,
    fontWeight: '400',
  },
  primaryButton: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 12,
  },
  primaryButtonText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 15,
  },
  testNote: {
    fontSize: 11,
    lineHeight: 15,
    textAlign: 'center',
    marginTop: 10,
    paddingHorizontal: 8,
  },
  laterLink: {
    alignSelf: 'center',
    marginTop: 16,
    padding: 8,
  },
  legalNote: {
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
    marginTop: 18,
    paddingHorizontal: 4,
  },
  legalLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  legalLinkText: {
    fontSize: 12,
    fontWeight: '600',
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 12,
    marginTop: 14,
    gap: 10,
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

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { getIsPremium, setIsPremium as persistIsPremium } from './storage';
import { IAP_AVAILABLE, fetchCustomerIsPremium, getCurrentOffering, purchasePackage, restorePurchases } from './iap';
import type { PurchasesOffering, PurchasesPackage } from './iap';

export const FREE_CUSTOM_CATEGORY_LIMIT = 2;

/** True when a free-tier user has hit (or passed) a usage limit. Premium users never hit a limit. */
export function hasReachedFreeLimit(isPremium: boolean, used: number, limit: number): boolean {
  return !isPremium && used >= limit;
}

interface PremiumContextValue {
  isPremium: boolean;
  ready: boolean;
  /** True in a real dev/production build with a RevenueCat key configured; false in Expo Go, on web, or before real keys are set. */
  iapAvailable: boolean;
  /** The current RevenueCat offering (packages available to buy). Only populated when iapAvailable. */
  offering: PurchasesOffering | null;
  /** Instant test-mode unlock when !iapAvailable; a real store purchase of `pkg` when iapAvailable. */
  unlock: (pkg?: PurchasesPackage) => Promise<void>;
  /** Restores prior store purchases. Resolves to whether the entitlement is active afterward. Only meaningful when iapAvailable. */
  restore: () => Promise<boolean>;
  reset: () => Promise<void>;
}

const PremiumContext = createContext<PremiumContextValue | null>(null);

export function PremiumProvider({ children }: { children: ReactNode }) {
  const [isPremium, setIsPremiumState] = useState(false);
  const [ready, setReady] = useState(false);
  const [offering, setOffering] = useState<PurchasesOffering | null>(null);

  useEffect(() => {
    (async () => {
      if (IAP_AVAILABLE) {
        const [premiumFromStore, currentOffering] = await Promise.all([fetchCustomerIsPremium(), getCurrentOffering()]);
        setIsPremiumState(premiumFromStore);
        setOffering(currentOffering);
        // Cache locally so a cold start before the store responds still has a reasonable last-known value.
        await persistIsPremium(premiumFromStore);
      } else {
        setIsPremiumState(await getIsPremium());
      }
      setReady(true);
    })();
  }, []);

  const unlock = async (pkg?: PurchasesPackage) => {
    if (IAP_AVAILABLE) {
      if (!pkg) throw new Error('a package is required to purchase when real IAP is active');
      const nowPremium = await purchasePackage(pkg);
      setIsPremiumState(nowPremium);
      await persistIsPremium(nowPremium);
      return;
    }
    await persistIsPremium(true);
    setIsPremiumState(true);
  };

  const restore = async (): Promise<boolean> => {
    if (!IAP_AVAILABLE) throw new Error('iap-unavailable');
    const nowPremium = await restorePurchases();
    setIsPremiumState(nowPremium);
    await persistIsPremium(nowPremium);
    return nowPremium;
  };

  const reset = async () => {
    await persistIsPremium(false);
    setIsPremiumState(false);
  };

  return (
    <PremiumContext.Provider value={{ isPremium, ready, iapAvailable: IAP_AVAILABLE, offering, unlock, restore, reset }}>
      {children}
    </PremiumContext.Provider>
  );
}

export function usePremium() {
  const ctx = useContext(PremiumContext);
  if (!ctx) throw new Error('usePremium must be used within PremiumProvider');
  return ctx;
}

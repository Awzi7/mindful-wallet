import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import type PurchasesType from 'react-native-purchases';
import type { CustomerInfo, PurchasesOffering, PurchasesPackage } from 'react-native-purchases';

// react-native-purchases registers native modules at import time, which don't exist in Expo Go
// or on web, so the require() itself must be guarded (same pattern as expo-glass-effect in
// components/FloatingTabBar.tsx) — not just calls into the module.
let Purchases: typeof PurchasesType | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  Purchases = require('react-native-purchases').default;
} catch {
  Purchases = null;
}

const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string | undefined>;
const IOS_API_KEY = extra.revenueCatApiKeyIos;
const ANDROID_API_KEY = extra.revenueCatApiKeyAndroid;
export const ENTITLEMENT_ID = extra.revenueCatEntitlementId || 'premium';

// The API keys ship as placeholders until the app's own RevenueCat project exists;
// treat a placeholder as "not configured" so IAP stays off until real keys are set.
function isRealKey(key: string | undefined): key is string {
  return !!key && !key.startsWith('YOUR_');
}

const apiKey = Platform.OS === 'ios' ? IOS_API_KEY : Platform.OS === 'android' ? ANDROID_API_KEY : undefined;
const runningInExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

/** True only in a real dev/production build (never Expo Go or web) with a real RevenueCat key set. */
export const IAP_AVAILABLE = Boolean(Purchases) && !runningInExpoGo && Platform.OS !== 'web' && isRealKey(apiKey);

let configured = false;

function configureIfNeeded(): void {
  if (!IAP_AVAILABLE || configured || !Purchases) return;
  Purchases.configure({ apiKey: apiKey! });
  configured = true;
}

function hasEntitlement(info: CustomerInfo): boolean {
  return Boolean(info.entitlements.active[ENTITLEMENT_ID]);
}

export async function getCurrentOffering(): Promise<PurchasesOffering | null> {
  if (!IAP_AVAILABLE || !Purchases) return null;
  configureIfNeeded();
  const offerings = await Purchases.getOfferings();
  return offerings.current ?? null;
}

export async function fetchCustomerIsPremium(): Promise<boolean> {
  if (!IAP_AVAILABLE || !Purchases) return false;
  configureIfNeeded();
  const info = await Purchases.getCustomerInfo();
  return hasEntitlement(info);
}

export async function purchasePackage(pkg: PurchasesPackage): Promise<boolean> {
  if (!IAP_AVAILABLE || !Purchases) throw new Error('iap-unavailable');
  configureIfNeeded();
  const { customerInfo } = await Purchases.purchasePackage(pkg);
  return hasEntitlement(customerInfo);
}

export async function restorePurchases(): Promise<boolean> {
  if (!IAP_AVAILABLE || !Purchases) throw new Error('iap-unavailable');
  configureIfNeeded();
  const info = await Purchases.restorePurchases();
  return hasEntitlement(info);
}

export type { PurchasesOffering, PurchasesPackage };

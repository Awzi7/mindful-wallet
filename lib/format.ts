import { CURRENCY_META, CurrencyCode } from './types';
import { getSyncLanguage } from './i18n/current';
import { LOCALE_MAP } from './i18n/dictionaries';

export function formatMoney(amount: number, currency: CurrencyCode = 'USD'): string {
  const meta = CURRENCY_META[currency];
  const num = Math.round(amount).toLocaleString(LOCALE_MAP[getSyncLanguage()]);
  return meta.symbolBefore ? `${meta.symbol}${num}` : `${num} ${meta.symbol}`;
}

export function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}

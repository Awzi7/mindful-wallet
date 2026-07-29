import { Language } from './dictionaries';

// A synchronous mirror of I18nProvider's language state, kept in sync by the provider.
// Lets plain (non-hook) functions like formatMoney read the active language without
// needing every caller to thread it through as a parameter.
let current: Language = 'ru';

export function getSyncLanguage(): Language {
  return current;
}

export function setSyncLanguage(lang: Language): void {
  current = lang;
}

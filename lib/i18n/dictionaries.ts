import ru from './ru';
import en from './en';
import uk from './uk';

export type Language = 'ru' | 'en' | 'uk';

export const LANGUAGES: Language[] = ['ru', 'en', 'uk'];

export const LANGUAGE_LABELS: Record<Language, string> = {
  ru: 'Русский',
  en: 'English',
  uk: 'Українська',
};

/** Flag emoji shown next to each language's native name. Intentionally none for Russian. */
export const LANGUAGE_FLAGS: Record<Language, string> = {
  ru: '',
  en: '🇬🇧',
  uk: '🇺🇦',
};

/** Locale used for number/date formatting (Intl, toLocaleString) - one per app language. */
export const LOCALE_MAP: Record<Language, string> = {
  ru: 'ru-RU',
  en: 'en-US',
  uk: 'uk-UA',
};

export const DICTIONARIES = { ru, en, uk };

export type Dictionary = typeof ru;

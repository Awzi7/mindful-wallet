import * as Localization from 'expo-localization';
import { getStoredLanguage } from '../storage';
import { Language, LANGUAGES } from './dictionaries';
import { resolve, resolveArray } from './translate';

function detectDeviceLanguage(): Language {
  try {
    const code = Localization.getLocales()[0]?.languageCode;
    if (code && (LANGUAGES as string[]).includes(code)) return code as Language;
  } catch {
    // ignore
  }
  return 'ru';
}

export async function getCurrentLanguage(): Promise<Language> {
  const stored = await getStoredLanguage();
  if (stored && (LANGUAGES as string[]).includes(stored)) return stored as Language;
  return detectDeviceLanguage();
}

export async function translateAsync(path: string, vars?: Record<string, string | number>): Promise<string> {
  const lang = await getCurrentLanguage();
  return resolve(lang, path, vars);
}

export async function translateArrayAsync(path: string): Promise<string[]> {
  const lang = await getCurrentLanguage();
  return resolveArray(lang, path);
}

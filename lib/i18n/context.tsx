import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import * as Localization from 'expo-localization';

import { getStoredLanguage, setStoredLanguage } from '../storage';
import { Language, LANGUAGES } from './dictionaries';
import { resolve, resolveArray } from './translate';
import { setSyncLanguage } from './current';

interface I18nContextValue {
  language: Language;
  setLanguage: (l: Language) => void;
  t: (path: string, vars?: Record<string, string | number>) => string;
  tArray: (path: string) => string[];
}

const I18nContext = createContext<I18nContextValue | null>(null);

function detectDeviceLanguage(): Language {
  try {
    const code = Localization.getLocales()[0]?.languageCode;
    if (code && (LANGUAGES as string[]).includes(code)) return code as Language;
  } catch {
    // ignore — fall through to default
  }
  return 'ru';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('ru');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    getStoredLanguage().then((stored) => {
      const lang = stored && (LANGUAGES as string[]).includes(stored) ? (stored as Language) : detectDeviceLanguage();
      setLanguageState(lang);
      setSyncLanguage(lang);
      setReady(true);
    });
  }, []);

  const setLanguage = (l: Language) => {
    setLanguageState(l);
    setSyncLanguage(l);
    setStoredLanguage(l);
  };

  const t = (path: string, vars?: Record<string, string | number>) => resolve(language, path, vars);
  const tArray = (path: string) => resolveArray(language, path);

  if (!ready) return null;

  return <I18nContext.Provider value={{ language, setLanguage, t, tArray }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}

import { CustomCategory } from './types';
import { Language } from './i18n/dictionaries';

/**
 * Best-effort amount extraction from free text: picks the largest plausible number.
 * This is regex/heuristic parsing, not language understanding — good enough to catch
 * "sneakers for 150" but not to reason about anything more subtle than a number.
 */
export function parseAmount(text: string): number | null {
  const matches = text.match(/\d[\d\s.,]*\d|\d/g);
  if (!matches) return null;

  const numbers = matches
    .map((raw) => {
      const cleaned = raw.replace(/\s/g, '');
      const lastComma = cleaned.lastIndexOf(',');
      const lastDot = cleaned.lastIndexOf('.');
      let normalized = cleaned;
      if (lastComma > -1 && lastDot > -1) {
        // Both separators present: whichever comes last is the decimal point.
        normalized = lastComma > lastDot ? cleaned.replace(/\./g, '').replace(',', '.') : cleaned.replace(/,/g, '');
      } else if (lastComma > -1) {
        // Only commas: treat as a decimal point if exactly 2 digits follow the last one,
        // otherwise it's a thousands separator (e.g. "1,200" vs "12,50").
        normalized = /,\d{2}$/.test(cleaned) ? cleaned.replace(',', '.') : cleaned.replace(/,/g, '');
      }
      return parseFloat(normalized);
    })
    .filter((n) => Number.isFinite(n) && n > 0);

  if (numbers.length === 0) return null;
  return Math.max(...numbers);
}

const CATEGORY_KEYWORDS: Record<Language, Record<string, string[]>> = {
  ru: {
    food: ['еда', 'продукты', 'продукт', 'магазин', 'супермаркет'],
    cafe: ['кафе', 'ресторан', 'кофе', 'бар', 'обед', 'ужин', 'завтрак'],
    transport: ['такси', 'бензин', 'метро', 'автобус', 'транспорт', 'машина', 'заправка'],
    clothes: ['одежда', 'кроссовки', 'куртка', 'джинсы', 'обувь', 'футболка', 'платье', 'ботинки'],
    entertainment: ['кино', 'игра', 'концерт', 'развлечения', 'билет', 'подписка'],
  },
  en: {
    food: ['food', 'groceries', 'grocery', 'supermarket'],
    cafe: ['cafe', 'coffee', 'restaurant', 'bar', 'lunch', 'dinner', 'breakfast'],
    transport: ['taxi', 'gas', 'fuel', 'metro', 'bus', 'transport', 'car'],
    clothes: ['clothes', 'sneakers', 'jacket', 'jeans', 'shoes', 'shirt', 'dress', 'boots'],
    entertainment: ['movie', 'cinema', 'game', 'concert', 'ticket', 'subscription'],
  },
  uk: {
    food: ['їжа', 'продукти', 'продукт', 'магазин', 'супермаркет'],
    cafe: ['кафе', 'ресторан', 'кава', 'бар', 'обід', 'вечеря', 'сніданок'],
    transport: ['таксі', 'бензин', 'метро', 'автобус', 'транспорт', 'машина'],
    clothes: ['одяг', 'кросівки', 'куртка', 'джинси', 'взуття', 'футболка', 'сукня', 'черевики'],
    entertainment: ['кіно', 'гра', 'концерт', 'розваги', 'квиток', 'підписка'],
  },
};

/** Matches the question against custom category labels first, then built-in category keywords. */
export function parseCategory(text: string, language: Language, customCategories: CustomCategory[]): string | null {
  const lower = text.toLowerCase();

  for (const cat of customCategories) {
    if (cat.label && lower.includes(cat.label.toLowerCase())) return cat.id;
  }

  const keywords = CATEGORY_KEYWORDS[language];
  for (const categoryId of Object.keys(keywords)) {
    if (keywords[categoryId].some((kw) => lower.includes(kw))) return categoryId;
  }
  return null;
}

export interface ParsedPurchaseQuestion {
  amount: number | null;
  categoryId: string | null;
}

export function parsePurchaseQuestion(
  text: string,
  language: Language,
  customCategories: CustomCategory[]
): ParsedPurchaseQuestion {
  return {
    amount: parseAmount(text),
    categoryId: parseCategory(text, language, customCategories),
  };
}

export type Intent = 'greeting' | 'thanks' | 'status' | 'goal' | 'compare' | 'tips' | 'purchase';

const INTENT_KEYWORDS: Record<
  Language,
  { greeting: string[]; thanks: string[]; status: string[]; goal: string[]; compare: string[]; tips: string[] }
> = {
  ru: {
    greeting: ['привет', 'здравствуй', 'здравствуйте', 'хай', 'добрый день', 'доброе утро', 'добрый вечер'],
    thanks: ['спасибо', 'благодарю', 'спс'],
    status: ['сколько я потратил', 'сколько потратила', 'сколько потратил', 'мои траты', 'сколько трачу', 'как бюджет', 'как мой бюджет'],
    goal: ['моя цель', 'сколько до цели', 'прогресс цели', 'мои накопления'],
    compare: ['сравн', 'по сравнению'],
    tips: ['совет', 'подскажи', 'сэконом', 'как экономить'],
  },
  en: {
    greeting: ['hi', 'hello', 'hey', 'good morning', 'good afternoon', 'good evening'],
    thanks: ['thanks', 'thank you', 'thx'],
    status: ['how much have i spent', 'how much did i spend', 'my spending', 'my budget'],
    goal: ['my goal', 'goal progress', 'how close am i to my goal', 'savings progress'],
    compare: ['compare', 'vs last week', 'versus last week', 'compared to last week'],
    tips: ['tip', 'advice', 'how can i save', 'how to save'],
  },
  uk: {
    greeting: ['привіт', 'вітаю', 'добрий день', 'доброго ранку', 'добрий вечір'],
    thanks: ['дякую', 'дяка'],
    status: ['скільки я витратив', 'скільки я витратила', 'мої витрати', 'як мій бюджет'],
    goal: ['моя ціль', 'скільки до цілі', 'прогрес цілі'],
    compare: ['порівня', 'у порівнянні'],
    tips: ['порад', 'заощад', 'як економити'],
  },
};

/**
 * Keyword-based intent classification. Greeting/thanks only match short messages so a real
 * question that happens to start with "hi" doesn't get derailed into a canned reply.
 */
export function classifyIntent(text: string, language: Language): Intent {
  const lower = text.toLowerCase().trim();
  const kw = INTENT_KEYWORDS[language];
  const wordCount = lower.split(/\s+/).filter(Boolean).length;

  if (wordCount <= 4 && kw.greeting.some((g) => lower.includes(g))) return 'greeting';
  if (wordCount <= 4 && kw.thanks.some((t) => lower.includes(t))) return 'thanks';
  if (kw.compare.some((c) => lower.includes(c))) return 'compare';
  if (kw.tips.some((tp) => lower.includes(tp))) return 'tips';
  if (kw.status.some((s) => lower.includes(s))) return 'status';
  if (kw.goal.some((g) => lower.includes(g))) return 'goal';
  return 'purchase';
}

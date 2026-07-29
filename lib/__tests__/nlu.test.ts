import { parseAmount, parseCategory, parsePurchaseQuestion } from '../nlu';

describe('parseAmount', () => {
  it('picks a plain integer out of surrounding text', () => {
    expect(parseAmount('sneakers for 150')).toBe(150);
  });

  it('treats a comma as a thousands separator when not followed by exactly 2 digits', () => {
    expect(parseAmount('a new laptop for 1,200')).toBe(1200);
  });

  it('treats a trailing 2-digit comma as a decimal separator', () => {
    expect(parseAmount('coffee for 12,50')).toBe(12.5);
  });

  it('handles both separators together, decimal last', () => {
    expect(parseAmount('price is 1.234,56')).toBeCloseTo(1234.56);
  });

  it('handles both separators together, decimal first', () => {
    expect(parseAmount('price is 1,234.56')).toBeCloseTo(1234.56);
  });

  it('picks the largest number when multiple appear', () => {
    expect(parseAmount('2 jackets at 300 each, saw one for 250 too')).toBe(300);
  });

  it('returns null when there is no number at all', () => {
    expect(parseAmount('should I buy new shoes?')).toBeNull();
  });
});

describe('parseCategory', () => {
  it('matches a built-in category keyword in Russian', () => {
    expect(parseCategory('хочу купить кроссовки', 'ru', [])).toBe('clothes');
  });

  it('matches a built-in category keyword in English', () => {
    expect(parseCategory('should I get new sneakers', 'en', [])).toBe('clothes');
  });

  it('matches a built-in category keyword in Ukrainian', () => {
    expect(parseCategory('чи варто купити кросівки', 'uk', [])).toBe('clothes');
  });

  it('prefers a matching custom category label over built-in keywords', () => {
    const customCategories = [{ id: 'custom-1', label: 'Гаджеты', icon: 'phone-portrait-outline', color: '#000' }];
    expect(parseCategory('хочу новые гаджеты', 'ru', customCategories)).toBe('custom-1');
  });

  it('returns null when nothing matches', () => {
    expect(parseCategory('something completely unrelated', 'en', [])).toBeNull();
  });
});

describe('parsePurchaseQuestion', () => {
  it('combines amount and category extraction', () => {
    expect(parsePurchaseQuestion('sneakers for 150', 'en', [])).toEqual({ amount: 150, categoryId: 'clothes' });
  });

  it('returns nulls when nothing is parseable', () => {
    expect(parsePurchaseQuestion('just wondering', 'en', [])).toEqual({ amount: null, categoryId: null });
  });
});

import { escapeCsvField, transactionsToCsv } from '../csv';
import { Transaction } from '../types';

function tx(partial: Partial<Transaction> & { id: string; createdAt: string }): Transaction {
  return { amount: 10, category: 'food', ...partial };
}

const OPTIONS = {
  headers: ['Date', 'Time', 'Type', 'Category', 'Amount', 'Currency', 'Place', 'Note'],
  expenseLabel: 'Expense',
  incomeLabel: 'Income',
  categoryLabel: (id: string) => (id === 'food' ? 'Food' : id),
  currency: 'USD',
};

describe('escapeCsvField', () => {
  it('leaves plain values untouched', () => {
    expect(escapeCsvField('Coffee')).toBe('Coffee');
  });

  it('quotes a value containing a comma', () => {
    expect(escapeCsvField('Cafe, corner of 5th')).toBe('"Cafe, corner of 5th"');
  });

  it('doubles embedded quotes and wraps the field', () => {
    expect(escapeCsvField('the "good" bakery')).toBe('"the ""good"" bakery"');
  });

  it('quotes a value containing a newline', () => {
    expect(escapeCsvField('line one\nline two')).toBe('"line one\nline two"');
  });

  it('quotes a value containing a carriage return', () => {
    expect(escapeCsvField('a\rb')).toBe('"a\rb"');
  });
});

describe('transactionsToCsv', () => {
  it('writes a header row even with no transactions', () => {
    const csv = transactionsToCsv([], OPTIONS);
    expect(csv).toBe('Date,Time,Type,Category,Amount,Currency,Place,Note');
  });

  it('writes local date and time, not a raw ISO timestamp', () => {
    const created = new Date(2026, 6, 15, 9, 5); // 15 July 2026, 09:05 local
    const csv = transactionsToCsv([tx({ id: '1', createdAt: created.toISOString() })], OPTIONS);
    const [, row] = csv.split('\r\n');

    expect(row.startsWith('2026-07-15,09:05,')).toBe(true);
  });

  it('labels income and expense rows distinctly', () => {
    const created = new Date(2026, 6, 15, 12, 0).toISOString();
    const csv = transactionsToCsv(
      [
        tx({ id: 'a', createdAt: created, amount: 100, category: 'salary', type: 'income' }),
        tx({ id: 'b', createdAt: created, amount: 20 }),
      ],
      OPTIONS
    );

    expect(csv).toContain(',Income,');
    expect(csv).toContain(',Expense,');
  });

  it('escapes a place containing a comma so columns do not shift', () => {
    const created = new Date(2026, 6, 15, 12, 0).toISOString();
    const csv = transactionsToCsv([tx({ id: '1', createdAt: created, place: 'Cafe, corner' })], OPTIONS);
    const [, row] = csv.split('\r\n');

    expect(row).toContain('"Cafe, corner"');
    // 8 columns: the quoted comma must not create a ninth.
    expect(row.match(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/g)?.length).toBe(7);
  });

  it('writes the amount as a bare number a spreadsheet can sum', () => {
    const created = new Date(2026, 6, 15, 12, 0).toISOString();
    const csv = transactionsToCsv([tx({ id: '1', createdAt: created, amount: 1234.5 })], OPTIONS);

    expect(csv).toContain(',1234.5,USD,');
  });

  it('resolves category labels rather than emitting raw ids', () => {
    const created = new Date(2026, 6, 15, 12, 0).toISOString();
    const csv = transactionsToCsv([tx({ id: '1', createdAt: created })], OPTIONS);

    expect(csv).toContain(',Food,');
  });

  it('orders rows newest first', () => {
    const older = new Date(2026, 6, 1, 10, 0).toISOString();
    const newer = new Date(2026, 6, 20, 10, 0).toISOString();
    const csv = transactionsToCsv(
      [tx({ id: 'old', createdAt: older, place: 'OLD' }), tx({ id: 'new', createdAt: newer, place: 'NEW' })],
      OPTIONS
    );
    const rows = csv.split('\r\n');

    expect(rows[1]).toContain('NEW');
    expect(rows[2]).toContain('OLD');
  });
});

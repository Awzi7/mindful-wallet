import { Transaction, isIncome } from './types';

/**
 * Escapes one CSV field per RFC 4180: wrap in quotes when the value contains a comma, a quote,
 * or a line break, and double any embedded quotes. `place` and `note` are free text the user
 * types, so all three cases are reachable - an unescaped comma silently shifts every later
 * column, which is the classic way an export looks fine and imports wrong.
 */
export function escapeCsvField(value: string): string {
  if (!/[",\r\n]/.test(value)) return value;
  return `"${value.replace(/"/g, '""')}"`;
}

export interface CsvOptions {
  /** Column headers, already translated by the caller. */
  headers: string[];
  /** Labels for the type column, already translated. */
  expenseLabel: string;
  incomeLabel: string;
  /** Resolves a category id to its display label. */
  categoryLabel: (id: string) => string;
  currency: string;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * Renders transactions as CSV, newest first. Dates are written as YYYY-MM-DD and HH:MM in local
 * time - spreadsheet apps parse that reliably, unlike a raw ISO timestamp with a Z suffix, which
 * Excel tends to leave as text.
 */
export function transactionsToCsv(transactions: Transaction[], options: CsvOptions): string {
  const rows: string[] = [options.headers.map(escapeCsvField).join(',')];

  const sorted = [...transactions].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  for (const tx of sorted) {
    const d = new Date(tx.createdAt);
    const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    const cells = [
      date,
      time,
      isIncome(tx) ? options.incomeLabel : options.expenseLabel,
      options.categoryLabel(tx.category),
      // Plain number, no thousands separator or currency symbol, so spreadsheets read it as a number.
      String(tx.amount),
      options.currency,
      tx.place ?? '',
      tx.note ?? '',
    ];
    rows.push(cells.map(escapeCsvField).join(','));
  }

  return rows.join('\r\n');
}

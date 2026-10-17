export type CashEntry = { date: string; amount: number; kind: 'income' | 'expense' };
export function sumCash(entries: CashEntry[], prefix: string) {
  let income = 0, expense = 0;
  for (const entry of entries) {
    if (!entry.date.startsWith(prefix)) continue;
    if (entry.kind === 'income') income += entry.amount;
    else expense += entry.amount;
  }
  return { income, expense, net: income - expense };
}
export function cashDate(value?: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return '';
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0,10) === value ? value : '';
}

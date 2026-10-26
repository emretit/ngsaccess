import type { FunctionReturnType } from 'convex/server';
import type { api } from '../../../convex/_generated/api';
export type TransactionPage = FunctionReturnType<typeof api.cardReadings.listReportTransactions>;
export interface TransactionSnapshots { pages: Readonly<Record<string, TransactionPage>> }
export type TransactionAction = { type: 'page'; cursor: string | null; page: TransactionPage } | { type: 'reset' };
export function transactionReducer(state: TransactionSnapshots, action: TransactionAction): TransactionSnapshots {
  if (action.type === 'reset') return { pages: {} };
  return { pages: { ...state.pages, [action.cursor ?? 'first']: action.page } };
}
export function transactionSnapshot(state: TransactionSnapshots, cursor: string | null, current?: TransactionPage): {
  rows: TransactionPage['page']; isDone: boolean; continueCursor: string | null;
} {
  const pages = current ? transactionReducer(state, { type: 'page', cursor, page: current }).pages : state.pages;
  const unique = new Map<TransactionPage['page'][number]['_id'], TransactionPage['page'][number]>();
  for (const page of Object.values(pages)) {
    for (const row of page.page) unique.set(row._id, row);
  }
  const latest = current ?? pages[cursor ?? 'first'];
  return { rows: [...unique.values()], isDone: latest?.isDone ?? false, continueCursor: latest?.continueCursor ?? null };
}

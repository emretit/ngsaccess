import { describe, expect, it } from 'vitest';
import { transactionReducer, transactionSnapshot } from './transactions';
import { transactionPage } from './testFixtures';
describe('transaction page snapshots', () => {
  it('appends frozen pages, deduplicates IDs and totals the hidden count once per cursor', () => {
    const first = transactionPage('a', 3);
    const state = transactionReducer({ pages: {} }, { type: 'page', cursor: null, page: first });
    const second = { ...transactionPage('b', 2, true), page: [...first.page, ...transactionPage('b').page] };
    const result = transactionSnapshot(state, 'next', second);
    expect(result.rows.map(row => row._id)).toEqual(['a', 'b']); expect(result.hiddenBiometricCount).toBe(5); expect(result.isDone).toBe(true);
    expect(transactionSnapshot(state, null, first).hiddenBiometricCount).toBe(3);
    expect(Object.keys(state.pages)).toHaveLength(1);
  });
  it('permits an empty eligible page with a continuation and resets all state', () => {
    const page = { ...transactionPage('empty', 50), page: [] };
    const state = transactionReducer({ pages: {} }, { type: 'page', cursor: null, page });
    expect(transactionSnapshot(state, null)).toMatchObject({ rows: [], hiddenBiometricCount: 50, isDone: false, continueCursor: 'empty-next' });
    expect(transactionReducer(state, { type: 'reset' })).toEqual({ pages: {} });
  });
  it('uses the latest snapshot for a repeated cursor without adding the hidden count twice', () => {
    const state = transactionReducer({ pages: {} }, { type: 'page', cursor: null, page: transactionPage('a', 2) });
    const result = transactionSnapshot(state, null, transactionPage('b', 4, true));
    expect(result.rows.map(row => row._id)).toEqual(['b']); expect(result.hiddenBiometricCount).toBe(4); expect(result.isDone).toBe(true);
  });
});

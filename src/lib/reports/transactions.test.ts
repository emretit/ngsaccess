import { describe, expect, it } from 'vitest';
import { transactionReducer, transactionSnapshot } from './transactions';
import { transactionPage } from './testFixtures';
describe('transaction page snapshots', () => {
  it('appends frozen pages, deduplicates IDs and preserves completion state per cursor', () => {
    const first = transactionPage('a');
    const state = transactionReducer({ pages: {} }, { type: 'page', cursor: null, page: first });
    const second = { ...transactionPage('b', true), page: [...first.page, ...transactionPage('b').page] };
    const result = transactionSnapshot(state, 'next', second);
    expect(result.rows.map(row => row._id)).toEqual(['a', 'b']); expect(result.isDone).toBe(true);
    expect(Object.keys(state.pages)).toHaveLength(1);
  });
  it('permits an empty eligible page with a continuation and resets all state', () => {
    const page = { ...transactionPage('empty'), page: [] };
    const state = transactionReducer({ pages: {} }, { type: 'page', cursor: null, page });
    expect(transactionSnapshot(state, null)).toMatchObject({ rows: [], isDone: false, continueCursor: 'empty-next' });
    expect(transactionReducer(state, { type: 'reset' })).toEqual({ pages: {} });
  });
  it('uses the latest snapshot for a repeated cursor without retaining stale rows', () => {
    const state = transactionReducer({ pages: {} }, { type: 'page', cursor: null, page: transactionPage('a') });
    const result = transactionSnapshot(state, null, transactionPage('b', true));
    expect(result.rows.map(row => row._id)).toEqual(['b']); expect(result.isDone).toBe(true);
  });
});

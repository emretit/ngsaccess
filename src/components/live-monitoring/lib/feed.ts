import { mergeRows } from "./readings";
export type FeedRow = { _id: string; _creationTime: number };
/** Sunucu sayfa sınırı ile yerel tampon sınırı aynı olmalı; truncated hesabı buna dayanır. */
export const LIVE_LIMIT = 500;
/** truncated: bugünün tüm okumaları tamponda değil (tampon/ilk sayfa taştı ya da sunucu tarama sınırına vurdu); eski kayıt sorgusu bugünü de kapsamalı. */
export type FeedState<T> = { rows: T[]; watermark?: number; initialized: boolean; truncated: boolean; reloadRequired: boolean };
type FeedResponse<T> = { rows: T[]; latestCreationTime: number | null; hasMore: boolean; scanLimitReached?: boolean };
export const initialFeed = <T>(): FeedState<T> => ({ rows: [], initialized: false, truncated: false, reloadRequired: false });
export function consumeFeed<T extends FeedRow>(state: FeedState<T>, response: FeedResponse<T>, limit = LIVE_LIMIT): FeedState<T> {
  if (state.reloadRequired) return state;
  // Delta taşması aradaki kayıtları atlar; boşluk bırakmamak için tam yeniden yükleme gerekir.
  if (state.initialized && response.hasMore) return { ...state, reloadRequired: true };
  const merged = mergeRows(state.rows, response.rows, limit + 1);
  return { rows: merged.slice(0, limit), initialized: true, watermark: response.latestCreationTime ?? state.watermark, reloadRequired: false,
    truncated: state.truncated || Boolean(response.scanLimitReached) || merged.length > limit || (!state.initialized && response.hasMore) };
}
export type FeedAction<T> = { type: "consume"; response: FeedResponse<T> } | { type: "reload" };
export function feedReducer<T extends FeedRow>(state: FeedState<T>, action: FeedAction<T>): FeedState<T> {
  switch (action.type) {
    case "consume": return consumeFeed(state, action.response);
    case "reload": return initialFeed<T>();
  }
}

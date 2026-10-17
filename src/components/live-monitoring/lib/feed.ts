import { mergeRows } from "./readings";
export type FeedRow = { _id: string; _creationTime: number };
export type FeedState<T> = { buffer: T[]; snapshot: T[]; watermark?: number; initialized: boolean; paused: boolean; reloadRequired: boolean };
export const initialFeed = <T>(): FeedState<T> => ({ buffer: [], snapshot: [], initialized: false, paused: false, reloadRequired: false });
export function consumeFeed<T extends FeedRow>(state: FeedState<T>, response: { rows: T[]; latestCreationTime: number | null; hasMore: boolean }, limit = 500): FeedState<T> {
  if (state.reloadRequired) return state;
  if (state.initialized && response.hasMore) return { ...state, reloadRequired: true };
  const merged = mergeRows(state.buffer, response.rows, limit + 1);
  return { ...state, buffer: merged.slice(0, limit), snapshot: state.initialized ? state.snapshot : merged.slice(0, limit), initialized: true, watermark: response.latestCreationTime ?? state.watermark,
    reloadRequired: state.initialized && merged.length > limit };
}
export type FeedAction<T> = { type: "consume"; response: { rows: T[]; latestCreationTime: number | null; hasMore: boolean } } | { type: "pause" | "apply" | "tick" | "reload" };
export function feedReducer<T extends FeedRow>(state: FeedState<T>, action: FeedAction<T>): FeedState<T> {
  switch (action.type) {
    case "consume": return consumeFeed(state, action.response);
    case "pause": return state.paused ? state : { ...state, paused: true };
    case "apply": return state.reloadRequired ? state : { ...state, snapshot: state.buffer, paused: false };
    case "tick": return state.paused || state.reloadRequired || state.snapshot === state.buffer ? state : { ...state, snapshot: state.buffer };
    case "reload": return initialFeed<T>();
  }
}

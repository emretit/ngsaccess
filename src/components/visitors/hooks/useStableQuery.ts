import { useState } from "react";

// Keep the last resolved value during refreshes, but never across data scopes.
// A resolved null/empty result replaces the cache just like any other result.
export function useStableQuery<T>(value: T | undefined, scopeKey: string | undefined): T | undefined {
  const [previous, setPrevious] = useState({ scopeKey, value });
  if (previous.scopeKey !== scopeKey || (value !== undefined && previous.value !== value)) {
    setPrevious({ scopeKey, value });
  }
  return value !== undefined || previous.scopeKey !== scopeKey ? value : previous.value;
}

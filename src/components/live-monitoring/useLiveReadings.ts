import { useCallback, useEffect, useReducer, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { Reading, Filters } from "./lib/readings";
import { feedReducer, initialFeed } from "./lib/feed";
import { todayInTurkey } from "@/lib/date";
export function useLiveReadings(projectId: Id<"projects">, enabled: boolean, source: Filters["source"] = "all") {
  const [state, dispatch] = useReducer(feedReducer<Reading>, undefined, initialFeed<Reading>);
  const [scanLimitReached, setScanLimitReached] = useState(false);
  const [generation, setGeneration] = useState(0);
  const response = useQuery(api.cardReadings.listLiveSince, enabled ? { projectId, source: source === "all" ? undefined : source, limit: 500, afterCreationTime: state.watermark } : "skip");
  const reload = useCallback(() => { dispatch({ type: "reload" }); setScanLimitReached(false); setGeneration(n => n + 1); }, []);
  const pause = useCallback(() => dispatch({ type: "pause" }), []);
  const apply = useCallback(() => dispatch({ type: "apply" }), []);
  useEffect(() => {
    let day = todayInTurkey();
    const timer = window.setInterval(() => { const current = todayInTurkey(); if (current !== day) { day = current; reload(); } }, 1000);
    return () => window.clearInterval(timer);
  }, [reload]);
  useEffect(() => { if (response) { dispatch({ type: "consume", response }); if (response.scanLimitReached) setScanLimitReached(true); } }, [response, generation]);
  useEffect(() => {
    if (!enabled) return;
    const timer = window.setInterval(() => dispatch({ type: "tick" }), 1000);
    return () => window.clearInterval(timer);
  }, [enabled]);
  return { ...state, scanInfo: response ? { scannedCount: response.scannedCount, matchedCount: response.matchedCount, scanLimitReached: scanLimitReached || response.scanLimitReached } : undefined, pause, apply, reload, loading: !state.initialized };
}

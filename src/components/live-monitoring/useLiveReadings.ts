import { useCallback, useEffect, useReducer, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { Reading, Filters } from "./lib/readings";
import { feedReducer, initialFeed, LIVE_LIMIT } from "./lib/feed";
import { todayInTurkey } from "@/lib/date";
export function useLiveReadings(projectId: Id<"projects">, enabled: boolean, source: Filters["source"] = "all") {
  const [state, dispatch] = useReducer(feedReducer<Reading>, undefined, initialFeed<Reading>);
  const [generation, setGeneration] = useState(0);
  const [day, setDay] = useState(todayInTurkey);
  const response = useQuery(api.cardReadings.listLiveSince, enabled ? { projectId, source: source === "all" ? undefined : source, limit: LIVE_LIMIT, afterCreationTime: state.watermark } : "skip");
  const reload = useCallback(() => { dispatch({ type: "reload" }); setGeneration(n => n + 1); }, []);
  useEffect(() => {
    let current = todayInTurkey();
    const timer = window.setInterval(() => { const next = todayInTurkey(); if (next !== current) { current = next; setDay(next); reload(); } }, 1000);
    return () => window.clearInterval(timer);
  }, [reload]);
  useEffect(() => { if (state.reloadRequired) reload(); }, [state.reloadRequired, reload]);
  useEffect(() => { if (response) dispatch({ type: "consume", response }); }, [response, generation]);
  return { rows: state.rows, initialized: state.initialized, truncated: state.truncated, day, loading: !state.initialized };
}

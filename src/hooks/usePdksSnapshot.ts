import { usePdksLiveTable } from "./usePdksLiveTable";
import { trTodayKey } from "../../convex/lib/trDate";
import { invalidatePdksSnapshots, subscribePdksInvalidation } from "@/lib/pdksInvalidation";
import { pdksErrorMessage } from "@/lib/pdksErrors";
import { useEffect, useState } from "react";
import { useConvex } from "convex/react";
import { loadPdksTable, loadPdksPayroll, type TableArgs, type PayrollArgs, type PdksProgress } from "@/lib/pdksBatches";

type Client = ReturnType<typeof useConvex>;
export function usePdksRequest<A, T>(args: A | "skip", load: (client: Client, args: A, signal?: AbortSignal, progress?: PdksProgress) => Promise<T>, revision?: string, localRefresh = false) {
  const client = useConvex();
  const key = args === "skip" ? null : JSON.stringify(args);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ key: string | null; data?: T; error?: string; updatedAt?: number; progress?: string }>({ key: null });
  useEffect(() => {
    const refresh = () => setAttempt(value => value + 1);
    return subscribePdksInvalidation(refresh);
  }, []);
  useEffect(() => {
    const current = key === null ? "skip" : JSON.parse(key) as A;
    if (current === "skip") return;
    let active = true;
    const controller = new AbortController();
    setState({ key });
    void load(client, current, controller.signal, (complete, total) => { if (active) setState(previous => ({ ...previous, key, progress: `${complete}/${total} grup` })); }).then(data => {
      if (active) setState({ key, data, updatedAt: Date.now() });
    }).catch((error: unknown) => {
      if (active) setState({ key, error: pdksErrorMessage(error) });
    });
    return () => { active = false; controller.abort(); };
  }, [client, key, attempt, load, revision]);
  return { data: state.key === key ? state.data : undefined, error: state.key === key ? state.error : undefined,
    progress: state.key === key ? state.progress : undefined,
    updatedAt: state.key === key ? state.updatedAt : undefined,
    refresh: localRefresh ? () => setAttempt(value => value + 1) : invalidatePdksSnapshots };
}
export function usePdksTableSnapshot(args: TableArgs | "skip") {
  const today = trTodayKey();
  const live = args !== "skip" && (args.startDate ?? args.date ?? today) === today && (args.endDate ?? args.date ?? today) === today;
  const current = usePdksLiveTable(live ? args : "skip");
  const snapshot = usePdksRequest(live ? "skip" : args, loadPdksTable);
  return { ...(live ? current : snapshot), live };
}
export const usePdksPayrollSnapshot = (args: PayrollArgs | "skip") => usePdksRequest(args, loadPdksPayroll);

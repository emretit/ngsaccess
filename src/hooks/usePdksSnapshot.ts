import { invalidatePdksSnapshots, PDKS_INVALIDATED } from "@/lib/pdksInvalidation";
import { pdksErrorMessage } from "@/lib/pdksErrors";
import { useEffect, useState } from "react";
import { useConvex } from "convex/react";
import { loadPdksTable, loadPdksPayroll, type TableArgs, type PayrollArgs } from "@/lib/pdksBatches";

type Client = ReturnType<typeof useConvex>;
export function usePdksRequest<A, T>(args: A | "skip", load: (client: Client, args: A, signal?: AbortSignal) => Promise<T>) {
  const client = useConvex();
  const key = args === "skip" ? null : JSON.stringify(args);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ key: string | null; data?: T; error?: string }>({ key: null });
  useEffect(() => {
    const refresh = () => setAttempt(value => value + 1);
    window.addEventListener(PDKS_INVALIDATED, refresh);
    return () => window.removeEventListener(PDKS_INVALIDATED, refresh);
  }, []);
  useEffect(() => {
    const current = key === null ? "skip" : JSON.parse(key) as A;
    if (current === "skip") return;
    let active = true;
    const controller = new AbortController();
    setState({ key });
    void load(client, current, controller.signal).then(data => {
      if (active) setState({ key, data });
    }).catch((error: unknown) => {
      if (active) setState({ key, error: pdksErrorMessage(error) });
    });
    return () => { active = false; controller.abort(); };
  }, [client, key, attempt, load]);
  return { data: state.key === key ? state.data : undefined, error: state.key === key ? state.error : undefined,
    refresh: invalidatePdksSnapshots };
}
export const usePdksTableSnapshot = (args: TableArgs | "skip") => usePdksRequest(args, loadPdksTable);
export const usePdksPayrollSnapshot = (args: PayrollArgs | "skip") => usePdksRequest(args, loadPdksPayroll);

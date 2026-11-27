import { useConvex } from "convex/react";
import { usePdksRequest } from "./usePdksSnapshot";
import { loadAnnualOvertime, invalidateAnnualOvertime, type AnnualArgs } from "@/lib/pdksAnnual";
export function useAnnualOvertime(args: AnnualArgs | "skip") {
  const client = useConvex();
  const result = usePdksRequest(args, loadAnnualOvertime, undefined, true);
  return { ...result, refresh: () => { invalidateAnnualOvertime(client); result.refresh(); } };
}

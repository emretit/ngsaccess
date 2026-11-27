import { usePdksRequest } from "./usePdksSnapshot";
import { loadAnnualOvertime, type AnnualArgs } from "@/lib/pdksAnnual";
export const useAnnualOvertime = (args: AnnualArgs | "skip") => usePdksRequest(args, loadAnnualOvertime);

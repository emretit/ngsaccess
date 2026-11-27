/** One invalidation refreshes table, payroll and annual readers after a successful edit. */
export const PDKS_INVALIDATED = "pdks-invalidated";
let epoch = 0;
export const pdksEpoch = () => epoch;
export function invalidatePdksSnapshots() {
  epoch++;
  if (typeof window !== "undefined") window.dispatchEvent(new Event(PDKS_INVALIDATED));
}

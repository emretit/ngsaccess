import type { Doc } from "../_generated/dataModel";
import { isManager } from "./auth";

/** Pay is visible only to the two manager roles. Mask response data, never storage. */
export function canSeePay(user: Doc<"users">): boolean {
  return isManager(user);
}

export function maskPay<T>(value: T, canSee: boolean): T | null {
  return canSee ? value : null;
}

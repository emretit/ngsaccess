import { ConvexError } from "convex/values";
import { errorMessage } from "@/lib/notify";

type ShiftErrorCode = "SHIFT_OVERLAP" | "SHIFT_CALENDAR_CONFLICT";
export function shiftError(error: unknown): { code?: ShiftErrorCode; message: string } {
  const message = errorMessage(error);
  if (error instanceof ConvexError) {
    const data: unknown = error.data;
    if (data && typeof data === "object" && "code" in data &&
      (data.code === "SHIFT_OVERLAP" || data.code === "SHIFT_CALENDAR_CONFLICT")) {
      return { code: data.code, message };
    }
  }
  // Older deployments still send prefixed strings.
  const code = message.includes("OVERLAP:") ? "SHIFT_OVERLAP"
    : message.includes("CALENDAR:") ? "SHIFT_CALENDAR_CONFLICT" : undefined;
  return { code, message };
}

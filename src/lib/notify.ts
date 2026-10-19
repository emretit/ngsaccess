import { ConvexError } from "convex/values";
import { toast } from "sonner";

const FALLBACK_ERROR = "İşlem tamamlanamadı. Lütfen tekrar deneyin.";

/** Removes transport envelopes and stack details before a message reaches the UI. */
function cleanErrorMessage(raw: string): string {
  let message = raw.trim();
  const uncaught = /Uncaught (?:ConvexError|Error):\s*/i.exec(message);
  if (uncaught) message = message.slice(uncaught.index + uncaught[0].length);
  message = message
    .replace(/^(?:\[(?:CONVEX\b[^\]]*|Request ID:[^\]]*)\]\s*)+/i, "")
    .replace(/^Server Error\b[:\s]*/i, "")
    .replace(/^(?:ConvexError|Error):\s*/i, "")
    .split(/\r?\n|\s+at\s+|Called by client/i, 1)[0]
    .trim();

  // An unrecognised envelope or a path-only diagnostic is not a user message.
  if (!message || /^at\s|\[CONVEX\b|\[Request ID:|\bServer Error\b|Uncaught (?:ConvexError|Error):|(?:^|[\s(])(?:\.{1,2}\/|\/(?:[^\s/]+\/)+|[A-Z]:\\)|\b[\w.-]+\.[cm]?[jt]sx?:\d+/i.test(message)) {
    return FALLBACK_ERROR;
  }
  return message;
}

/** Sunucunun Türkçe hata açıklamasını korur; bilinmeyen değerleri kullanıcıya dökmez. */
export function errorMessage(error: unknown): string {
  if (error instanceof ConvexError) {
    const data: unknown = error.data;
    if (typeof data === "string") return cleanErrorMessage(data);
    if (data && typeof data === "object" && "message" in data && typeof data.message === "string") {
      return cleanErrorMessage(data.message);
    }
    return FALLBACK_ERROR;
  }
  if (error instanceof Error) return cleanErrorMessage(error.message);
  if (typeof error === "string") return cleanErrorMessage(error);
  return FALLBACK_ERROR;
}

export const notify = {
  success(title: string, description?: string) {
    return toast.success(title, { description });
  },
  error(title: string, error?: unknown) {
    return toast.error(title, { description: errorMessage(error) });
  },
  info(title: string, description?: string) {
    return toast.info(title, { description });
  },
};

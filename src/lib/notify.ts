import { ConvexError } from "convex/values";
import { toast } from "sonner";

const FALLBACK_ERROR = "İşlem tamamlanamadı. Lütfen tekrar deneyin.";

/** Sunucunun Türkçe hata açıklamasını korur; bilinmeyen değerleri kullanıcıya dökmez. */
export function errorMessage(error: unknown): string {
  if (error instanceof ConvexError) {
    const data: unknown = error.data;
    if (typeof data === "string") return data.trim() || FALLBACK_ERROR;
    if (data && typeof data === "object" && "message" in data && typeof data.message === "string") {
      return data.message.trim() || FALLBACK_ERROR;
    }
    return FALLBACK_ERROR;
  }
  if (error instanceof Error) return error.message.trim() || FALLBACK_ERROR;
  if (typeof error === "string") return error.trim() || FALLBACK_ERROR;
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

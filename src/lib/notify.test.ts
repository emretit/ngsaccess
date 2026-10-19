import { ConvexError } from "convex/values";
import { describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { errorMessage, notify } from "./notify";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

const fallback = "İşlem tamamlanamadı. Lütfen tekrar deneyin.";
const explanation = "Bu e-posta adresi başka bir personelde kullanılıyor";

describe("errorMessage", () => {
  it("extracts the server explanation from a real Convex development error", () => {
    const error = new Error("[CONVEX M(employees:create)] [Request ID: 1195fb85d2501fdf] Server Error Uncaught Error: Bu e-posta adresi başka bir personelde kullanılıyor at handler (../../convex/employees.ts:215:4) at async handler (../../node_modules/convex-helpers/server/customFunctions.js:268:27) Called by client");
    expect(errorMessage(error)).toBe(explanation);
  });

  it("preserves ConvexError string and object data", () => {
    expect(errorMessage(new ConvexError(explanation))).toBe(explanation);
    expect(errorMessage(new ConvexError({ code: "DUPLICATE", message: explanation }))).toBe(explanation);
  });

  it.each([
    `[CONVEX M(employees:create)] [Request ID: abc] Server Error Uncaught ConvexError: ${explanation} at handler (../../convex/employees.ts:1:2) Called by client`,
    `[CONVEX M(employees:create)] [Request ID: abc]\nServer Error\nUncaught Error: ${explanation}\n    at handler (../../convex/employees.ts:1:2)\nCalled by client`,
    `[CONVEX M(employees:create)] [Request ID: abc] ${explanation} Called by client`,
    `Uncaught Error: ${explanation}\r\n    at handler (C:\\app\\convex\\employees.ts:1:2)`,
    `${explanation} Called by client`,
  ])("removes wrapper and stack details: %s", (message) => {
    expect(errorMessage(new Error(message))).toBe(explanation);
  });

  it.each([
    "Server Error",
    "[CONVEX M(employees:create)] [Request ID: abc] Server Error\nCalled by client",
    "[CONVEX M(employees:create)] [Request ID: abc]",
    "Uncaught Error: at handler (../../convex/employees.ts:1:2)",
    "../../convex/employees.ts:1:2",
    "/Users/project/convex/employees.ts:1:2",
    "C:\\project\\convex\\employees.ts:1:2",
    "",
    "   ",
    undefined,
    null,
    42,
    { message: explanation },
  ])("uses the fallback for empty, unknown, or technical errors: %s", (error) => {
    expect(errorMessage(error)).toBe(fallback);
  });

  it("uses the fallback for unusable ConvexError data", () => {
    expect(errorMessage(new ConvexError({ code: "UNKNOWN" }))).toBe(fallback);
    expect(errorMessage(new ConvexError(" "))).toBe(fallback);
    expect(errorMessage(new ConvexError({ message: 42 }))).toBe(fallback);
  });

  it("also cleans technical details from ConvexError data", () => {
    expect(errorMessage(new ConvexError({ message: `${explanation}\n at handler (../../convex/employees.ts:1:2)` }))).toBe(explanation);
  });

  it("preserves an already clean Turkish message", () => {
    expect(errorMessage(new Error(explanation))).toBe(explanation);
    expect(errorMessage(`  ${explanation}  `)).toBe(explanation);
  });
});

describe("existing notification behavior", () => {
  it("ConvexError veri açıklamasını teknik wrapper yerine gösterir", () => {
    expect(errorMessage(new ConvexError("Bu projeye erişim yetkiniz yok"))).toBe("Bu projeye erişim yetkiniz yok");
    expect(errorMessage(new ConvexError({ message: "Kayıt bulunamadı", code: "NOT_FOUND" }))).toBe("Kayıt bulunamadı");
  });
  it("Error ve metin açıklamalarını korur", () => {
    expect(errorMessage(new Error(" Cihaz silinemedi "))).toBe("Cihaz silinemedi");
    expect(errorMessage("Bağlantı kesildi")).toBe("Bağlantı kesildi");
  });
  it.each([undefined, null, {}, 42, " ", new Error(""), new ConvexError({ code: "FAILED" })])(
    "bilinmeyen/boş hata için Türkçe yedek metin verir: %s", (error) => {
      expect(errorMessage(error)).toBe("İşlem tamamlanamadı. Lütfen tekrar deneyin.");
    },
  );
  it("ortak API Sonner'a birer bildirim iletir", () => {
    notify.success("Kaydedildi", "Değişiklikler saklandı");
    notify.info("Sıraya alındı");
    notify.error("Silinemedi", new ConvexError("Bağlı kayıt var"));
    expect(toast.success).toHaveBeenCalledWith("Kaydedildi", { description: "Değişiklikler saklandı" });
    expect(toast.info).toHaveBeenCalledWith("Sıraya alındı", { description: undefined });
    expect(toast.error).toHaveBeenCalledWith("Silinemedi", { description: "Bağlı kayıt var" });
  });
});

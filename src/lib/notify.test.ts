import { describe, expect, it, vi } from "vitest";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import { errorMessage, notify } from "./notify";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

describe("errorMessage", () => {
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

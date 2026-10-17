import { describe, expect, it } from "vitest";
import { ConvexError } from "convex/values";
import { consumeFeed, feedReducer, initialFeed } from "./feed";
import { emptyFilters, matches, mergeRows, physicalCard, readFilters, sourceLabel, trTime, writeFilters, type Reading } from "./readings";
import { assignmentSuccess, assignmentValidation } from "./assignment";
import { errorMessage } from "@/lib/notify";
import type { Id } from "../../../../convex/_generated/dataModel";
const row = (id: string, time: number): Reading => ({ _id: id as Id<"cardReadings">, _creationTime: time, cardNo: "0008219", accessTime: "2026-10-16T23:00:00Z", source: "card", devices: null, employees: null, door: null });
const response = (rows: Reading[], hasMore = false) => ({ rows, latestCreationTime: rows[0]?._creationTime ?? null, hasMore });
describe("canlı tampon sözleşmesi", () => {
  it("ilk snapshot yeni olay değildir ve başlangıç hasMore kabul edilir", () => { const s = consumeFeed(initialFeed<Reading>(), response([row("a", 1)], true)); expect(s.snapshot).toEqual(s.buffer); expect(s.reloadRequired).toBe(false); });
  it("_id tekilleştirir ve eşit zamanları kimlikle sıralar", () => expect(mergeRows([row("a", 1)], [row("a", 1), row("b", 1), row("c", 2)]).map(r => r._id)).toEqual(["c", "b", "a"]));
  it("duraklatma snapshot ve odağı sabit tutar, alım sürer", () => { const first = consumeFeed(initialFeed<Reading>(), response([row("a", 1)])); const paused = feedReducer(first, { type: "pause" }); const next = consumeFeed(paused, response([row("b", 2)])); expect(next.snapshot).toBe(first.snapshot); expect(next.watermark).toBe(2); expect(feedReducer(next, { type: "tick" }).snapshot).toBe(first.snapshot); expect(feedReducer(next, { type: "apply" }).snapshot).toBe(next.buffer); });
  it("delta taşmasında watermark ve snapshot ilerlemez", () => { const first = consumeFeed(initialFeed<Reading>(), response([row("a", 1)])); const overflow = consumeFeed(first, response([row("b", 4)], true)); expect(overflow.reloadRequired).toBe(true); expect(overflow.watermark).toBe(1); expect(overflow.snapshot).toBe(first.snapshot); expect(feedReducer(overflow, { type: "apply" })).toBe(overflow); });
  it("yerel tampon sınırlıdır ve taşma görünürdür", () => { const first = consumeFeed(initialFeed<Reading>(), response([row("a", 1)]), 1); const next = consumeFeed(first, response([row("b", 2)]), 1); expect(next.buffer).toHaveLength(1); expect(next.reloadRequired).toBe(true); });
  it("boş delta watermarkı korur, yeniden yükleme/proje başlangıcı temizler", () => { const s = consumeFeed(initialFeed<Reading>(), response([row("a", 7)])); expect(consumeFeed(s, response([])).watermark).toBe(7); expect(feedReducer(s, { type: "reload" })).toEqual(initialFeed()); });
  it("geç teslim olayında accessTime sıralama veya watermark değildir", () => { const late = { ...row("late", 9), accessTime: "2025-01-01T00:00:00Z" }; const s = consumeFeed(initialFeed<Reading>(), response([late])); expect(s.watermark).toBe(9); });
  it("yeni olay sayacı yalnız seçili filtreye uyan benzersiz satırlardır", () => { const rows = mergeRows([row("a", 1)], [{ ...row("a", 1), accessStatus: "reddedildi" }, { ...row("b", 2), accessStatus: "izin_verildi" }]); expect(rows.filter(r => matches(r, { ...emptyFilters, result: "denied" }))).toHaveLength(1); });
});
describe("URL ve kaynak", () => {
  it("filtreleri ve okuma kimliğini kayıpsız taşır", () => { const f = { ...emptyFilters, mode: "history" as const, search: "Işıl 0001", result: "unknown" as const, device: "d", employee: "p", door: "k", start: "2026-10-17" }; const url = writeFilters(new URLSearchParams("reading=id&other=value"), f, "project"); expect(readFilters(url, "project")).toEqual(f); expect(url.get("reading")).toBe("id"); expect(url.get("other")).toBe("value"); });
  it("proje değişiminde eski filtreyi kullanmaz", () => expect(readFilters(new URLSearchParams("liveProject=old&device=old&q=old"), "new")).toEqual(emptyFilters));
  it("geçersiz enum/tarihleri temizler ve tarih geçmişe geçirir", () => { expect(readFilters(new URLSearchParams("result=no&start=oops"), "p").result).toBe("all"); expect(readFilters(new URLSearchParams("end=2026-10-17"), "p").mode).toBe("history"); });
  it.each([["card", "Kart"], ["qr", "QR"], ["mobile", "Mobil"], ["biometric", "Biyometrik · PDKS dışı"], ["unknown", "Kaynak bilinmiyor"]] as const)("%s sunucu kaynağını etiketler", (source, label) => expect(sourceLabel(source)).toBe(label));
  it("TR saatini tarayıcıdan bağımsız gösterir", () => expect(trTime("2026-10-16T23:00:00Z")).toContain("17.10.2026 02:00:00"));
});
describe("kart atama formu fixture'ları", () => {
  it.each(["", "000000", "IADE:12", "https://token", "unknown", "null", " 001"])("geçersiz credential: %s", card => expect(physicalCard(card)).toBe(false));
  it("baştaki sıfırları ve boş mevcut kartı aynen korur", () => { expect(physicalCard("0008219")).toBe(true); const values = { employeeId: "p", expectedCurrentCard: "", replace: false }; expect(assignmentValidation(values, { cardNumber: "" }, "0008219")).toBeNull(); expect(values.expectedCurrentCard).toBe(""); });
  it("kişi gerektirir ve kart değiştirme onayını denetler", () => { expect(assignmentValidation({ employeeId: "", expectedCurrentCard: null, replace: false }, undefined, "new")).toBe("Bir kişi seçin"); expect(assignmentValidation({ employeeId: "p", expectedCurrentCard: "old", replace: false }, { cardNumber: "old" }, "new")).toContain("onaylayın"); });
  it("pasif kişi seçili durumdayken pasife geçerse atamayı engeller", () => expect(assignmentValidation({ employeeId: "p", expectedCurrentCard: "", replace: false }, { cardNumber: "", isActive: false }, "0001")).toContain("Pasif"));
  it("yarışta yeniden onay ister; sessiz güncel kart kabul etmez", () => expect(assignmentValidation({ employeeId: "p", expectedCurrentCard: "old", replace: true }, { cardNumber: "new" }, "other")).toContain("kartı değişti"));
  it.each(["CARD_CHANGED", "DUPLICATE_CARD", "INVALID_CARD_SOURCE"])("sunucu hatası korunur: %s", code => { const message = `${code} Türkçe açıklama`; expect(errorMessage(new ConvexError({ code, message }))).toBe(message); });
  it("cihaz hedefi olmadığında bekliyor demez", () => expect(assignmentSuccess({ syncStatus: "noTargets" })).toContain("kayıtlı cihaz yok"));
  it("cihaz teslimini başarı diye bildirmez", () => { const base = { employeeId: "p" as Id<"employees">, cardNumber: "0001" }; expect(assignmentSuccess({ ...base, syncStatus: "pending" })).toContain("bekleniyor"); expect(assignmentSuccess({ ...base, syncStatus: "notRequested" })).toContain("doğrulanmadı"); });
});

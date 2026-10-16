import { describe, expect, it } from "vitest";
import { VISITOR_PRESENCE_READING_LIMIT, visitorPresence, visitorDetailsError, visitorExpiryError } from "./visitorPresence";
import { toPatch } from "./nullablePatch";

const entry = { accessTime: "2026-10-16T09:00:00Z", accessStatus: "izin_verildi", direction: "entry" };
const exit = { accessTime: "2026-10-16T10:00:00Z", accessStatus: "izin_verildi", direction: "exit" };
describe("ziyaretçi konum kanıtı", () => {
  it("reddedilen giriş konumu değiştirmez", () => {
    expect(visitorPresence([exit, { ...entry, accessTime: "2026-10-16T11:00:00Z", accessStatus: "reddedildi" }]).presence).toBe("outside");
  });
  it("reddedilen çıkış konumu değiştirmez", () => {
    expect(visitorPresence([entry, { ...exit, accessStatus: "reddedildi" }]).presence).toBe("inside");
  });
  it("teslim/eklenme sırası yerine accessTime kullanır", () => {
    expect(visitorPresence([exit, entry]).presence).toBe("outside");
    expect(visitorPresence([entry, exit]).presence).toBe("outside");
  });
  it("başarılı yönlü kanıt yoksa ve eşzamanlı çelişkide bilinmiyor", () => {
    expect(visitorPresence([{ ...entry, accessStatus: undefined }]).presence).toBe("unknown");
    expect(visitorPresence([{ ...entry, direction: undefined }]).presence).toBe("unknown");
    expect(visitorPresence([entry, { ...entry, direction: "exit" }]).presence).toBe("unknown");
    expect(visitorPresence([]).presence).toBe("unknown");
  });
  it("süre dolumu veya erişim iptali çıkış kanıtı değildir", () => {
    expect(visitorPresence([entry]).presence).toBe("inside");
  });
});

describe("ziyaretçi kayıt doğrulaması", () => {
  const input = { firstName: "Ada", lastName: "Soyad", cardNumber: "123", accessExpiresAt: "2026-10-17T09:00:00Z" };
  const now = Date.parse("2026-10-16T09:00:00Z");
  it.each([
    { firstName: " " }, { lastName: " " }, { cardNumber: "IADE:123:id" }, { cardNumber: " IADE:123:id" },
    { cardNumber: "" }, { accessExpiresAt: "bad" }, { accessExpiresAt: "2026-10-15T09:00:00Z" },
  ])("geçersiz kayıt/yeniden aktivasyonu engeller: %j", (patch) => {
    expect(visitorDetailsError({ ...input, ...patch }, now)).toBeTruthy();
  });
  it("geçerli kart ve gelecek bitişi kabul eder", () => {
    expect(visitorDetailsError(input, now)).toBeNull();
  });
  it("boşaltılan telefon/not/ev sahibi alanlarını temizler", () => {
    const patch = toPatch({ visitorPhone: null, notes: null, hostEmployeeId: null, visitorCompany: undefined });
    expect(Object.keys(patch)).toEqual(["visitorPhone", "notes", "hostEmployeeId"]);
    expect(patch).toEqual({ visitorPhone: undefined, notes: undefined, hostEmployeeId: undefined });
  });
});

describe("ziyaretçi sınırlı okuma ve düzenleme", () => {
  it("son 50 teslim içinde başarılı yönlü olay yoksa bilinmiyor döner", () => {
    const readings = [...Array.from({ length: VISITOR_PRESENCE_READING_LIMIT }, () => ({ ...exit, accessStatus: "reddedildi" })), entry];
    expect(visitorPresence(readings.slice(0, VISITOR_PRESENCE_READING_LIMIT))).toEqual({ lastDirection: null, lastReadingAt: null, presence: "unknown" });
  });
  it("sınırlı pencerede olay zamanını ve izinli yönü korur", () => {
    expect(visitorPresence([entry, exit, { ...exit, accessTime: "2026-10-16T12:00:00Z", direction: undefined }]).presence).toBe("outside");
  });
  it("mevcut süresi geçmiş kayıt kişisel bilgi düzenlemesini engellemez", () => {
    const expired = { firstName: "Ada", lastName: "Soyad", cardNumber: "123", accessExpiresAt: "2020-01-01T00:00:00Z" };
    expect(visitorDetailsError(expired, Date.now(), false)).toBeNull();
    expect(visitorExpiryError(expired.accessExpiresAt)).toBe("Geçerlilik bitişi gelecekte olmalıdır");
    expect(visitorExpiryError("invalid")).toBeTruthy();
  });
});

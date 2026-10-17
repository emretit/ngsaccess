import { describe, expect, it } from "vitest";
import type { Id } from "../_generated/dataModel";
import { classifyReadingSource, countPdksReadingSources, filterPdksReadings, isPdksEligibleReading } from "./pdksSource";
import { selectProjectScope } from "./projectScope";

describe("PDKS source boundary", () => {
  it.each(["face", "fingerPrint", "cardAndFace", "cardAndFingerPrint", "cardAndFp", "iris", "faceAndPin"])("%s dışlanır", hikCurrentVerifyMode => {
    const reading = { hikCurrentVerifyMode, cardNo: "123", hikMajorEventType: 5, hikSubEventType: 1 };
    expect(classifyReadingSource(reading)).toBe("biometric");
    expect(isPdksEligibleReading(reading)).toBe(false);
  });
  it.each(["cardOrFace", "cardOrFp", "faceOrFpOrCardOrPw"])("%s modunda kart olayı kart sayılır, kanıtsız olay biyometrik kalır", hikCurrentVerifyMode => {
    expect(classifyReadingSource({ hikCurrentVerifyMode, cardNo: "123", hikMajorEventType: 5, hikSubEventType: 1 })).toBe("card");
    expect(classifyReadingSource({ hikCurrentVerifyMode, cardNo: "123", hikMajorEventType: 5, hikSubEventType: 0x999 })).toBe("biometric");
    expect(classifyReadingSource({ hikCurrentVerifyMode, cardNo: "123" })).toBe("biometric");
  });
  it("kelime içindeki 'or' VEYA modu sayılmaz", () => {
    expect(classifyReadingSource({ hikCurrentVerifyMode: "facePassword", hikMajorEventType: 5, hikSubEventType: 1 })).toBe("biometric");
    expect(classifyReadingSource({ hikCurrentVerifyMode: "card_or_face", hikMajorEventType: 5, hikSubEventType: 1 })).toBe("card");
  });
  it.each([0x26, 0x28, 0x2b, 0x2e, 0x36, 0x39, 0x3c, 0x3f, 0x42, 0x45, 0x48, 0x4b, 0x4d, 0x68, 0x69, 0xbe])("biyometrik minor %i kart modundan önceliklidir", hikSubEventType => {
    expect(classifyReadingSource({ hikMajorEventType: 5, hikSubEventType, hikCurrentVerifyMode: "card" })).toBe("biometric");
  });
  it.each([[1, "card"], [2, "card"], [0x65, "pin"], [0xb5, "pin"], [0x9c, "qr"], [0x9f, "mobile"], [0x999, "unknown"]] as const)("minor %i → %s", (hikSubEventType, expected) => {
    expect(classifyReadingSource({ hikMajorEventType: 5, hikSubEventType, cardNo: "123" })).toBe(expected);
  });
  it("IDE, QR, mobil, manuel ve eski kart kayıtlarını ayırır", () => {
    expect(classifyReadingSource({ ideIoId: 0, cardNo: "123" })).toBe("card");
    expect(classifyReadingSource({ rawData: JSON.stringify({ payload: { method: "pin" }, transaction: { type: "access_event" } }) })).toBe("pin");
    expect(classifyReadingSource({ rawData: "qr_checkin:lat=1,lng=2" })).toBe("qr");
    expect(classifyReadingSource({ cardNo: "123", rawData: '{"user_id":"12345678-1234-1234-1234-123456789abc","serial":"reader"}' })).toBe("qr");
    expect(classifyReadingSource({ cardNo: "123", rawData: '<EventNotificationAlert><majorEventType>5</majorEventType><subEventType>75</subEventType></EventNotificationAlert>' })).toBe("biometric");
    expect(classifyReadingSource({ rawData: '{"source":"mobile_qr"}' })).toBe("qr");
    expect(classifyReadingSource({ rawData: '{"source":"mobile"}' })).toBe("mobile");
    expect(classifyReadingSource({ rawData: '{"source":"manual"}' })).toBe("manual");
    expect(classifyReadingSource({ cardNo: "123", rawData: "invalid json" })).toBe("card");
    expect(classifyReadingSource({})).toBe("unknown");
  });
  it("Hik belirsizliği kart no ile kapanmaz, major alanı minor yorumunu sınırlar", () => {
    expect(classifyReadingSource({ hikMajorEventType: 3, hikSubEventType: 0x4b, cardNo: "123" })).toBe("unknown");
    expect(classifyReadingSource({ rawData: '{"AccessControllerEvent":{"currentVerifyMode":"face"}}' })).toBe("biometric");
    expect(isPdksEligibleReading({ hikMajorEventType: 5, hikSubEventType: 999 })).toBe(true);
    expect(countPdksReadingSources([{ hikCurrentVerifyMode: "face" }, { hikMajorEventType: 5, hikSubEventType: 999 }])).toMatchObject({ biometric: 1, unknown: 1 });
  });
  it("izinli iki proje olsa da seçilen proje dışındaki ve projesiz okumaları dışlar", () => {
    const a = "a" as Id<"projects">;
    const b = "b" as Id<"projects">;
    const scope = selectProjectScope([a, b], a);
    const raw = [{ projectId: a, cardNo: "1" }, { projectId: b, cardNo: "2" }, { cardNo: "3" }, { projectId: a, hikCurrentVerifyMode: "face" }];
    expect(filterPdksReadings(raw, scope[0])).toEqual([raw[0]]);
    expect(filterPdksReadings(raw)).toHaveLength(3);
    expect(raw).toHaveLength(4);
    expect(() => selectProjectScope([a], b)).toThrow("erişim yetkiniz yok");
  });
});

import { describe, it, expect } from "vitest";
import {
  inferAccessStatus,
  inferDenialReason,
  HIK_MAJOR_EVENT_TYPES,
  HIK_SUB_EVENT_GRANTED,
  HIK_SUB_EVENT_DENIED,
  HIK_DENIAL_REASONS,
} from "./hikEventCodes";

const { DEVICE_EVENT, DEVICE_ALARM, DEVICE_OPERATION, DEVICE_EXCEPTION } =
  HIK_MAJOR_EVENT_TYPES;

describe("hikEventCodes – inferAccessStatus", () => {
  it("DEVICE_EVENT + granted sub → izin_verildi", () => {
    expect(inferAccessStatus(DEVICE_EVENT, 1)).toBe("izin_verildi");
  });

  it("DEVICE_ALARM + granted sub → izin_verildi", () => {
    expect(inferAccessStatus(DEVICE_ALARM, 1)).toBe("izin_verildi");
  });

  it("DEVICE_EVENT + denied sub → reddedildi", () => {
    expect(inferAccessStatus(DEVICE_EVENT, 6)).toBe("reddedildi");
  });

  it("DEVICE_ALARM + denied sub → reddedildi", () => {
    expect(inferAccessStatus(DEVICE_ALARM, 8)).toBe("reddedildi");
  });

  it("ilgisiz major (DEVICE_OPERATION) → undefined (caller fallback)", () => {
    expect(inferAccessStatus(DEVICE_OPERATION, 1)).toBeUndefined();
  });

  it("ilgisiz major (DEVICE_EXCEPTION) → undefined", () => {
    expect(inferAccessStatus(DEVICE_EXCEPTION, 6)).toBeUndefined();
  });

  it("major undefined → undefined", () => {
    expect(inferAccessStatus(undefined, 1)).toBeUndefined();
  });

  it("sub undefined → undefined", () => {
    expect(inferAccessStatus(DEVICE_EVENT, undefined)).toBeUndefined();
  });

  it("bilinmeyen sub kodu → undefined", () => {
    expect(inferAccessStatus(DEVICE_EVENT, 9999)).toBeUndefined();
  });

  it("tüm GRANTED kodları izin_verildi döner", () => {
    for (const sub of HIK_SUB_EVENT_GRANTED) {
      expect(inferAccessStatus(DEVICE_EVENT, sub)).toBe("izin_verildi");
    }
  });

  it("tüm DENIED kodları reddedildi döner", () => {
    for (const sub of HIK_SUB_EVENT_DENIED) {
      expect(inferAccessStatus(DEVICE_EVENT, sub)).toBe("reddedildi");
    }
  });
});

describe("hikEventCodes – inferDenialReason", () => {
  it("bilinen ret kodu → açıklama", () => {
    expect(inferDenialReason(6)).toBe("Yetki yok");
    expect(inferDenialReason(8)).toBe("Süresi dolmuş kart");
  });

  it("undefined → undefined", () => {
    expect(inferDenialReason(undefined)).toBeUndefined();
  });

  it("bilinmeyen kod → undefined", () => {
    expect(inferDenialReason(9999)).toBeUndefined();
  });

  it("granted kod (1) → ret nedeni yok", () => {
    expect(inferDenialReason(1)).toBeUndefined();
  });
});

// SDK/ISAPI "Access Control Event Types" tablosundan golden değerler. Bu kodlar
// PDKS kaydının izin/ret kararını belirler — yanlış eşleme bordroyu bozar.
describe("hikEventCodes – SDK golden eşleme", () => {
  it.each([
    [0x01, "kart"],
    [0x02, "kart + şifre"],
    [0x26, "parmak izi"],
    [0x28, "kart + parmak izi"],
    [0x3c, "yüz + kart"],
    [0x45, "personel no + parmak izi"],
    [0x4b, "yüz"],
    [0x4d, "personel no + yüz"],
    [0x65, "personel no + şifre"],
    [0x9c, "QR kod"],
    [0xbe, "iris"],
  ])("minor %i (%s) → izin_verildi", (minor) => {
    expect(inferAccessStatus(DEVICE_EVENT, minor)).toBe("izin_verildi");
  });

  it.each([
    [0x03, "kart + şifre başarısız"],
    [0x06, "yetki yok"],
    [0x27, "parmak izi eşleşmedi"],
    [0x3d, "yüz + kart başarısız"],
    [0x4c, "yüz doğrulama başarısız"],
    [0x4e, "personel no + yüz başarısız"],
    [0x50, "yüz tanıma başarısız"],
    [0x71, "kara liste"],
    [0x94, "şifre deneme limiti"],
    [0x98, "personel no yok"],
  ])("minor %i (%s) → reddedildi", (minor) => {
    expect(inferAccessStatus(DEVICE_EVENT, minor)).toBe("reddedildi");
  });

  it("regresyon: 76 (0x4c FACE_VERIFY_FAIL) izin sayılmaz, 77 (0x4d) ret sayılmaz", () => {
    expect(inferAccessStatus(DEVICE_EVENT, 76)).toBe("reddedildi");
    expect(inferAccessStatus(DEVICE_EVENT, 77)).toBe("izin_verildi");
  });

  it("kapı/buton durum kodları access kararı üretmez", () => {
    for (const minor of [0x15, 0x16, 0x17, 0x19, 0x1a, 0x1c]) {
      expect(inferAccessStatus(DEVICE_EVENT, minor)).toBeUndefined();
    }
  });
});

describe("hikEventCodes – tablo tutarlılığı", () => {
  it("GRANTED ve DENIED kümeleri kesişmez", () => {
    const overlap = [...HIK_SUB_EVENT_GRANTED].filter((c) =>
      HIK_SUB_EVENT_DENIED.has(c),
    );
    expect(overlap).toEqual([]);
  });

  it("her ret nedeni kodu DENIED kümesinde", () => {
    const orphanReasons = Object.keys(HIK_DENIAL_REASONS)
      .map(Number)
      .filter((c) => !HIK_SUB_EVENT_DENIED.has(c));
    expect(orphanReasons).toEqual([]);
  });
});

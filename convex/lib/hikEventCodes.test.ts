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

import { describe, expect, it } from "vitest";
import { accessEndsAtMs } from "./accessEnd";

describe("accessEndsAtMs", () => {
  it("bitiş yoksa undefined (cihazda sınırsız)", () => {
    expect(accessEndsAtMs({})).toBeUndefined();
    expect(accessEndsAtMs({ accessExpiresAt: "", employmentEndDate: "" })).toBeUndefined();
  });

  it("ziyaretçi bitişi: UTC ISO aynen, ofsetsiz değer TR saati", () => {
    expect(accessEndsAtMs({ accessExpiresAt: "2026-10-26T15:00:00.000Z" })).toBe(Date.parse("2026-10-26T15:00:00.000Z"));
    expect(accessEndsAtMs({ accessExpiresAt: "2026-10-26T18:00:00" })).toBe(Date.parse("2026-10-26T15:00:00.000Z"));
  });

  it("ayrılma tarihi: son gün dahil, TR 23:59:59.999", () => {
    expect(accessEndsAtMs({ employmentEndDate: "2026-10-31" })).toBe(Date.parse("2026-10-31T20:59:59.999Z"));
  });

  it("ikisi de varsa erken olan", () => {
    expect(accessEndsAtMs({ accessExpiresAt: "2026-11-05T09:00:00.000Z", employmentEndDate: "2026-10-31" }))
      .toBe(Date.parse("2026-10-31T20:59:59.999Z"));
    expect(accessEndsAtMs({ accessExpiresAt: "2026-10-30T09:00:00.000Z", employmentEndDate: "2026-10-31" }))
      .toBe(Date.parse("2026-10-30T09:00:00.000Z"));
  });

  it("geçersiz değerler yok sayılır", () => {
    expect(accessEndsAtMs({ accessExpiresAt: "yarın", employmentEndDate: "31.10.2026" })).toBeUndefined();
    expect(accessEndsAtMs({ accessExpiresAt: "2026-02-30T10:00:00Z" })).toBeUndefined();
    expect(accessEndsAtMs({ employmentEndDate: "2026-13-01" })).toBeUndefined();
    expect(accessEndsAtMs({ employmentEndDate: "2026-02-30" })).toBeUndefined();
  });
});

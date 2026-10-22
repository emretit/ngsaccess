import { describe, expect, it } from "vitest";
import { resolveAttendanceEvidence } from "./pdksEvidence";
import { LEGACY_PDKS_POLICY, type PdksDayPolicy } from "./pdksRules";
const entry = { accessTime: "2026-10-23T05:00:00.000Z", direction: "entry" };
const exit = { accessTime: "2026-10-23T14:00:00.000Z", direction: "exit" };
const policy = (requireCheckIn: boolean, requireCheckOut: boolean, missingRequiredPunch: "absent" | "review" = "review", noPunch: "absent" | "review" = "absent"): PdksDayPolicy => ({ ...LEGACY_PDKS_POLICY, punchMode: "requirements", requireCheckIn, requireCheckOut, missingRequiredPunch, noPunch });
describe("PDKS yön kanıtı", () => {
  for (const requireIn of [true, false]) for (const requireOut of [true, false]) for (const missing of ["absent", "review"] as const) {
    const p = policy(requireIn, requireOut, missing);
    const fail = missing === "review" ? "incomplete" : "absent";
    it(`matris ${requireIn}/${requireOut}/${missing}`, () => {
      expect(resolveAttendanceEvidence([entry, exit], undefined, p)).toMatchObject({ decision: "present", durationMeasured: true, punchQuality: "ok" });
      expect(resolveAttendanceEvidence([entry], undefined, p)).toMatchObject({ decision: requireOut ? fail : "present", durationMeasured: false, punchQuality: "missingExit" });
      expect(resolveAttendanceEvidence([exit], undefined, p)).toMatchObject({ decision: requireIn ? fail : "present", durationMeasured: false, punchQuality: "missingEntry" });
      expect(resolveAttendanceEvidence([], undefined, p)).toMatchObject({ decision: "absent", durationMeasured: false, punchQuality: "noPunch" });
      expect(resolveAttendanceEvidence([], undefined, { ...p, noPunch: "review" }).decision).toBe("incomplete");
    });
  }
  it("iki giriş ve ters çift süre üretmez", () => {
    expect(resolveAttendanceEvidence([entry, { ...exit, direction: "entry" }], undefined, policy(true, true))).toMatchObject({ decision: "incomplete", durationMeasured: false });
    expect(resolveAttendanceEvidence([{ ...entry, direction: "exit" }, { ...exit, direction: "entry" }], undefined, policy(true, true))).toMatchObject({ decision: "incomplete", durationMeasured: false });
  });
  it("yönsüz kayıt otomatik devamsız olmaz", () => {
    expect(resolveAttendanceEvidence([{ accessTime: entry.accessTime }], undefined, policy(true, true, "absent"))).toMatchObject({ decision: "incomplete", punchQuality: "undirected", durationMeasured: false });
  });
  it("manuel kendi yönünü tamamlar ve uygun son çıkışı seçer", () => {
    expect(resolveAttendanceEvidence([exit], { entryISO: "2026-10-23T08:00:00+03:00" }, policy(true, true))).toMatchObject({ firstISO: entry.accessTime, lastISO: exit.accessTime, durationMeasured: true, decision: "present" });
    expect(resolveAttendanceEvidence([entry], { exitISO: exit.accessTime }, policy(true, true))).toMatchObject({ durationMeasured: true, decision: "present" });
    expect(resolveAttendanceEvidence([], { exitISO: exit.accessTime }, policy(true, true))).toMatchObject({ durationMeasured: false, punchQuality: "missingEntry" });
  });
  it("legacy tek çıkışı bugünkü gibi giriş kabul eder", () => {
    expect(resolveAttendanceEvidence([exit], undefined, LEGACY_PDKS_POLICY)).toMatchObject({ firstISO: exit.accessTime, lastISO: null, decision: "present", durationMeasured: false });
  });
});

import { describe, expect, it } from "vitest";
import { buildDoorPlans, buildPersonPayload, hikValidBeginFromAccessStart } from "./persons";
import { parseHikJsonStatus } from "./core";

const person = { employeeNo: "123", name: "Employee", beginTime: "2026-01-01T00:00:00" };
describe("Hik door-to-plan payload", () => {
  it("preserves single-rule all-door payload exactly", () => {
    const old = buildPersonPayload({ ...person, doorCount: 2, planTemplateNo: 4 });
    expect(buildPersonPayload({ ...person, ...buildDoorPlans(2, [{ planTemplateNo: 4 }]) })).toEqual(old);
    expect(old).toMatchObject({ doorRight: "1,2", RightPlan: [{ doorNo: 1, planTemplateNo: "4" }, { doorNo: 2, planTemplateNo: "4" }] });
  });
  it("door-leg grants only selected doors", () => {
    expect(buildPersonPayload({ ...person, ...buildDoorPlans(4, [{ planTemplateNo: 5, doorNos: [2] }]) })).toMatchObject({ doorRight: "2", RightPlan: [{ doorNo: 2, planTemplateNo: "5" }] });
  });
  it("merges every rule into deterministic per-door comma-separated templates", () => {
    const scope = buildDoorPlans(3, [{ planTemplateNo: 7, doorNos: [2, 3] }, { planTemplateNo: 4 }, { planTemplateNo: 7, doorNos: [2] }]);
    expect(buildPersonPayload({ ...person, ...scope })).toMatchObject({ doorRight: "1,2,3", RightPlan: [{ doorNo: 1, planTemplateNo: "4" }, { doorNo: 2, planTemplateNo: "4,7" }, { doorNo: 3, planTemplateNo: "4,7" }] });
  });
  it("skips missing/out-of-range mappings and emits warnings", () => {
    const scope = buildDoorPlans(4, [{ planTemplateNo: 5, doorNos: [undefined, 0, 5, 2] }]);
    expect(scope.warnings).toHaveLength(3);
    expect(scope.doorPlans).toEqual([{ doorNo: 2, planTemplateNos: [5] }]);
  });
  it("empty scope is unauthorized even with a legacy fallback plan", () => {
    const scope = buildDoorPlans(4, [{ planTemplateNo: 5, doorNos: [undefined] }]);
    expect(() => buildPersonPayload({ ...person, planTemplateNo: 1, ...scope })).toThrow("unauthorized");
    expect(() => buildPersonPayload({ ...person, doorPlans: [] })).toThrow("unauthorized");
  });
});

describe("Hik toplu yanıt durumu", () => {
  it("UserInfo/Record iç içe 'ok' yanıtı başarıdır", () => {
    const data = { UserInfoOutList: { UserInfoOut: [{ employeeNo: "123", statusCode: 1, statusString: "OK", subStatusCode: "ok" }] } };
    expect(parseHikJsonStatus({ status: 200, data, raw: JSON.stringify(data) })).toEqual({ ok: true, alreadyExists: false });
  });
  it("iç içe hata kodu döner, 'ok' sayılmaz", () => {
    const data = { UserInfoOutList: { UserInfoOut: [{ subStatusCode: "ok" }, { subStatusCode: "badParameters" }] } };
    expect(parseHikJsonStatus({ status: 200, data, raw: "" })).toEqual({ ok: false, alreadyExists: false, error: "badParameters" });
  });
  it("iç içe 'zaten var' hâlâ alreadyExists'tir", () => {
    const data = { UserInfoOutList: { UserInfoOut: [{ subStatusCode: "employeeNoAlreadyExist" }] } };
    expect(parseHikJsonStatus({ status: 200, data, raw: "" })).toMatchObject({ ok: false, alreadyExists: true });
  });
  it("üst düzey statusCode hatası iç 'ok' ile örtülmez", () => {
    const data = { statusCode: 4, statusString: "Invalid Operation", Items: [{ subStatusCode: "ok" }] };
    expect(parseHikJsonStatus({ status: 200, data, raw: "" }).ok).toBe(false);
  });
});


describe("Hik access start validity", () => {
  const now = Date.parse("2026-10-22T09:00:00.000Z");
  it.each(["2026-11-01T00:00:00+03:00", "2026-10-31T21:00:00.000Z"])("writes Turkey local midnight from %s", accessStartsAt => {
    expect(buildPersonPayload({ ...person, planTemplateNo: 4, doorCount: 1, beginTime: hikValidBeginFromAccessStart(accessStartsAt, now) }).Valid)
      .toMatchObject({ beginTime: "2026-11-01T00:00:00", timeType: "local" });
  });
  it.each([undefined, "", "invalid", "2026-02-30T00:00:00+03:00", "2026-10-22T09:00:00.000Z", "2026-10-21T21:00:00.000Z"])("keeps the default for %s (missing, invalid, visitor registration time or past)", accessStartsAt => {
    expect(hikValidBeginFromAccessStart(accessStartsAt, now)).toBeUndefined();
    expect(buildPersonPayload({ employeeNo: "123", name: "Test", doorCount: 1, planTemplateNo: 4, beginTime: hikValidBeginFromAccessStart(accessStartsAt, now) }).Valid.beginTime)
      .toMatch(/^\d{4}-\d{2}-\d{2}T00:00:00$/);
  });
});

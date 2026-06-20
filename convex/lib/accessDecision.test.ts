import { describe, it, expect } from "vitest";
import { canEmployeeAccessDevice } from "./accessDecision";

describe("accessDecision – canEmployeeAccessDevice", () => {
  it("aynı kural, kural AKTİF → grant", () => {
    expect(
      canEmployeeAccessDevice({
        deviceGroupIds: ["r1"],
        employeeGroupIds: ["r1"],
        activeRuleIds: new Set(["r1"]),
      }),
    ).toBe(true);
  });

  it("aynı kural ama kural PASİF → deny", () => {
    expect(
      canEmployeeAccessDevice({
        deviceGroupIds: ["r1"],
        employeeGroupIds: ["r1"],
        activeRuleIds: new Set<string>(),
      }),
    ).toBe(false);
  });

  it("çalışan ve cihaz FARKLI kurallarda → deny", () => {
    expect(
      canEmployeeAccessDevice({
        deviceGroupIds: ["r1"],
        employeeGroupIds: ["r2"],
        activeRuleIds: new Set(["r1", "r2"]),
      }),
    ).toBe(false);
  });

  it("çoklu üyelik, biri cihaza bağlı ve aktif → grant", () => {
    expect(
      canEmployeeAccessDevice({
        deviceGroupIds: ["r3"],
        employeeGroupIds: ["r1", "r2", "r3"],
        activeRuleIds: new Set(["r3"]),
      }),
    ).toBe(true);
  });

  it("kesişen birden çok kural, hepsi pasif → deny", () => {
    expect(
      canEmployeeAccessDevice({
        deviceGroupIds: ["r1", "r2"],
        employeeGroupIds: ["r1", "r2"],
        activeRuleIds: new Set<string>(),
      }),
    ).toBe(false);
  });

  it("kesişen iki kuraldan yalnız biri aktif → grant", () => {
    expect(
      canEmployeeAccessDevice({
        deviceGroupIds: ["r1", "r2"],
        employeeGroupIds: ["r1", "r2"],
        activeRuleIds: new Set(["r2"]),
      }),
    ).toBe(true);
  });

  it("cihaz hiçbir kurala bağlı değil → deny", () => {
    expect(
      canEmployeeAccessDevice({
        deviceGroupIds: [],
        employeeGroupIds: ["r1"],
        activeRuleIds: new Set(["r1"]),
      }),
    ).toBe(false);
  });

  it("çalışan hiçbir kuralda değil → deny", () => {
    expect(
      canEmployeeAccessDevice({
        deviceGroupIds: ["r1"],
        employeeGroupIds: [],
        activeRuleIds: new Set(["r1"]),
      }),
    ).toBe(false);
  });

  it("aktif kural cihazda ama çalışanda yok (kesişim dışı) → deny", () => {
    // r1 aktif ve cihazda; çalışan yalnız r2'de → kesişim boş
    expect(
      canEmployeeAccessDevice({
        deviceGroupIds: ["r1"],
        employeeGroupIds: ["r2"],
        activeRuleIds: new Set(["r1"]),
      }),
    ).toBe(false);
  });

  it("aktif kural kesişimde değil, kesişimdeki kural pasif → deny", () => {
    // kesişim r2 (pasif); r1 aktif ama yalnız cihazda
    expect(
      canEmployeeAccessDevice({
        deviceGroupIds: ["r1", "r2"],
        employeeGroupIds: ["r2", "r3"],
        activeRuleIds: new Set(["r1"]),
      }),
    ).toBe(false);
  });
});

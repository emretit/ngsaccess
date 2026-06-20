import { describe, it, expect } from "vitest";
import { computeAuthorizedCards } from "./accessGraphPure";

// Testlerde basit normalize: trim'lenmiş boş-olmayan string geçer, gerisi null.
const normalizeCard = (c: unknown): string | null =>
  typeof c === "string" && c.trim() ? c.trim() : null;

describe("accessGraphPure – computeAuthorizedCards", () => {
  it("tek aktif kural → üyelerinin kartları", () => {
    const out = computeAuthorizedCards({
      ruleIds: ["r1"],
      activeRuleIds: new Set(["r1"]),
      membersByRule: new Map([["r1", ["e1", "e2"]]]),
      cardByEmployee: new Map([
        ["e1", "1001"],
        ["e2", "1002"],
      ]),
      normalizeCard,
    });
    expect([...out].sort()).toEqual(["1001", "1002"]);
  });

  it("pasif kural → kartları yetkiye katılmaz", () => {
    const out = computeAuthorizedCards({
      ruleIds: ["r1"],
      activeRuleIds: new Set<string>(), // r1 aktif değil
      membersByRule: new Map([["r1", ["e1"]]]),
      cardByEmployee: new Map([["e1", "1001"]]),
      normalizeCard,
    });
    expect(out.size).toBe(0);
  });

  it("iki kuralda ortak üye → kart bir kez (dedupe)", () => {
    const out = computeAuthorizedCards({
      ruleIds: ["r1", "r2"],
      activeRuleIds: new Set(["r1", "r2"]),
      membersByRule: new Map([
        ["r1", ["e1", "e2"]],
        ["r2", ["e2", "e3"]],
      ]),
      cardByEmployee: new Map([
        ["e1", "1001"],
        ["e2", "1002"],
        ["e3", "1003"],
      ]),
      normalizeCard,
    });
    expect([...out].sort()).toEqual(["1001", "1002", "1003"]);
  });

  it("normalize null dönen üye (boş/geçersiz kart) atlanır", () => {
    const out = computeAuthorizedCards({
      ruleIds: ["r1"],
      activeRuleIds: new Set(["r1"]),
      membersByRule: new Map([["r1", ["e1", "e2", "e3"]]]),
      cardByEmployee: new Map<string, unknown>([
        ["e1", "1001"],
        ["e2", "   "], // boşluk → null
        ["e3", null], // null kart
      ]),
      normalizeCard,
    });
    expect([...out]).toEqual(["1001"]);
  });

  it("cardByEmployee'de olmayan üye → normalize(undefined) null → atlanır", () => {
    const out = computeAuthorizedCards({
      ruleIds: ["r1"],
      activeRuleIds: new Set(["r1"]),
      membersByRule: new Map([["r1", ["eMissing"]]]),
      cardByEmployee: new Map<string, unknown>(),
      normalizeCard,
    });
    expect(out.size).toBe(0);
  });

  it("iki-grup senaryosu: A yetkisiz ama B aktif → kart yine yetkili (union)", () => {
    // Kişi e1 hem rA hem rB'de; rA pasif (activeRuleIds'de yok), rB aktif.
    const out = computeAuthorizedCards({
      ruleIds: ["rA", "rB"],
      activeRuleIds: new Set(["rB"]),
      membersByRule: new Map([
        ["rA", ["e1"]],
        ["rB", ["e1"]],
      ]),
      cardByEmployee: new Map([["e1", "1001"]]),
      normalizeCard,
    });
    expect([...out]).toEqual(["1001"]);
  });

  it("üyesi olmayan kural → boş set", () => {
    const out = computeAuthorizedCards({
      ruleIds: ["r1"],
      activeRuleIds: new Set(["r1"]),
      membersByRule: new Map<string, string[]>(),
      cardByEmployee: new Map<string, unknown>(),
      normalizeCard,
    });
    expect(out.size).toBe(0);
  });
});

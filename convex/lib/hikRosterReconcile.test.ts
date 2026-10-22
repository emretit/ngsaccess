import { describe, expect, it } from "vitest";
import { planHikRosterReconcile } from "./hikRosterReconcile";

describe("Hik roster deletion safety", () => {
  it("uses Hik string keys, preserves leading zeros and deletes original spelling once", () => {
    expect(planHikRosterReconcile([" 00123 ", "123", " old ", " old "], new Set(["00123"]), false))
      .toEqual({ safe: true, toDelete: ["123", " old "] });
  });
  it("never deletes with unavailable expected state", () => {
    expect(planHikRosterReconcile(["old"], null, false)).toMatchObject({ safe: false, toDelete: [], skippedReason: "expected_unavailable" });
  });
  it("protects a populated device from an empty expected set", () => {
    expect(planHikRosterReconcile(["old"], new Set(), false)).toMatchObject({ safe: false, toDelete: [], skippedReason: "expected_empty" });
    expect(planHikRosterReconcile([], new Set(), false)).toEqual({ safe: true, toDelete: [] });
  });
  it("fails closed on malformed identities", () => {
    expect(planHikRosterReconcile(["old"], new Set([" "]), false)).toMatchObject({ safe: false, toDelete: [] });
    expect(planHikRosterReconcile([""], new Set(["123"]), false)).toMatchObject({ safe: false, toDelete: [] });
  });
});

it("allows an authoritative empty registration roster but keeps other safety guards", () => {
  expect(planHikRosterReconcile(["old", "other"], new Set(), true)).toEqual({ safe: true, toDelete: ["old", "other"] });
  expect(planHikRosterReconcile(["old"], null, true)).toMatchObject({ safe: false, skippedReason: "expected_unavailable" });
  expect(planHikRosterReconcile([" "], new Set(), true)).toMatchObject({ safe: false, skippedReason: "invalid_identity" });
});

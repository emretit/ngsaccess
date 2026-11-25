import { describe, expect, it } from "vitest";
import { generateVisitorPin, generateVisitorToken, hashVisitorSecret, VISITOR_TOKEN_PATTERN } from "./visitorPass";

describe("visitor pass credentials", () => {
  it("creates 128-bit base64url QR credentials distinct from employee UUIDs", () => {
    const tokens = Array.from({ length: 100 }, generateVisitorToken);
    expect(new Set(tokens).size).toBe(100);
    for (const token of tokens) {
      expect(token).toMatch(VISITOR_TOKEN_PATTERN);
      expect(atob(token.slice(6).replace(/-/g, "+").replace(/_/g, "/") + "==")).toHaveLength(16);
    }
  });
  it("creates six-digit PINs and hashes with SHA-256, scoped by project", async () => {
    const pins = Array.from({ length: 100 }, generateVisitorPin);
    expect(pins.every(pin => /^\d{6}$/.test(pin))).toBe(true);
    expect(await hashVisitorSecret("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(await hashVisitorSecret("a:123456")).not.toBe(await hashVisitorSecret("b:123456"));
  });
});

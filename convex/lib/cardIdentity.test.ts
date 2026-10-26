// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "../schema";
import { cardConflictMessage, cardNumericKey, findDuplicateCard, NUMERIC_CARD_CONFLICT } from "./cardIdentity";

const modules = import.meta.glob("../**/*.ts");

describe("decimal card identity", () => {
  it.each([["00123", "123"], ["123", "123"], ["000", "0"], ["0", "0"], ["9007199254740991", "9007199254740991"],
    ["00ABC123", null], ["1e3", null], ["0x10", null], ["-1", null], ["", null], [" 123", null]] as const)("normalizes %s", (card, key) => {
    expect(cardNumericKey(card)).toBe(key);
    if (key !== null) expect(Number(key)).toBe(Number(card));
  });

  it("finds the 20-digit padded form, ignores self and preserves text matches", async () => {
    const t = convexTest(schema, modules);
    await t.run(async ctx => {
      const id = await ctx.db.insert("employees", { firstName: "Test", lastName: "Test", email: "test@example.test", cardNumber: "123".padStart(20, "0") });
      expect((await findDuplicateCard(ctx, "123"))?._id).toBe(id);
      expect(await findDuplicateCard(ctx, "123", id)).toBeNull();
      expect(await findDuplicateCard(ctx, "124")).toBeNull();
      const textId = await ctx.db.insert("employees", { firstName: "Text", lastName: "Test", email: "text@example.test", cardNumber: "00ABC123" });
      expect((await findDuplicateCard(ctx, "00ABC123"))?._id).toBe(textId);
      expect(await findDuplicateCard(ctx, "ABC123")).toBeNull();
    });
  });

  it("keeps the existing exact-card error and uses the numeric error for aliases", () => {
    expect(cardConflictMessage("123", { cardNumber: "00123" }, "Tam metin")).toBe(NUMERIC_CARD_CONFLICT);
    expect(cardConflictMessage("ABC", { cardNumber: "ABC" }, "Tam metin")).toBe("Tam metin");
  });
});

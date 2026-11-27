import { it, expect } from "vitest";
import { ConvexError } from "convex/values";
import { pdksErrorMessage } from "./pdksErrors";
it("distinguishes structured authorization failures without exposing server diagnostics", () => {
  const denied = new ConvexError({ code: "PDKS_FORBIDDEN" });
  denied.message = "Server Error: private request id";
  expect(pdksErrorMessage(denied)).toContain("yetkiniz yok");
  expect(pdksErrorMessage(new ConvexError({ code: "PDKS_READ_BUDGET" }))).toContain("Okuma sınırı");
  expect(pdksErrorMessage(new Error("sensitive request id"))).not.toContain("sensitive");
});

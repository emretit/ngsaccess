// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, it } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";
const modules = import.meta.glob("./**/*.ts");
it.each(["missing", "granted", "revoked", "grantedAgain"] as const)("face delivery respects explicit withdrawal: %s", async state => {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const userId = await ctx.db.insert("users", {});
    const employeeId = await ctx.db.insert("employees", { firstName: "A", lastName: "B", email: "face@example.test", cardNumber: "123" });
    const storageId = await ctx.storage.store(new Blob(["face"], { type: "image/jpeg" }));
    await ctx.db.insert("employeeFaces", { employeeId, pictureStorageId: storageId, addedAt: 1 });
    if (state !== "missing") await ctx.db.insert("employeeConsents", { employeeId, consentType: "biometric_face", grantedAt: "2026-01-01", grantedBy: userId, ...(state === "revoked" || state === "grantedAgain" ? { revokedAt: "2026-01-02" } : {}) });
    if (state === "grantedAgain") await ctx.db.insert("employeeConsents", { employeeId, consentType: "biometric_face", grantedAt: "2026-01-03", grantedBy: userId });
    return { employeeId, storageId };
  });
  const call = t.query(internal.employeeFaces.getStorageRef, { employeeId: ids.employeeId });
  if (state === "revoked") await expect(call).rejects.toThrow("Yüz tanıma rızası iptal edilmiş");
  else expect(await call).toMatchObject({ pictureStorageId: ids.storageId });
});

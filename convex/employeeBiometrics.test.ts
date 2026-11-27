// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

async function fixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "A", isActive: true });
    const foreignProjectId = await ctx.db.insert("projects", { name: "B", isActive: true });
    const adminId = await ctx.db.insert("users", { role: "project_admin" });
    const readerId = await ctx.db.insert("users", { role: "project_user" });
    const adminSession = await ctx.db.insert("authSessions", { userId: adminId, expirationTime: Date.now() + 86400000 });
    const readerSession = await ctx.db.insert("authSessions", { userId: readerId, expirationTime: Date.now() + 86400000 });
    for (const userId of [adminId, readerId]) await ctx.db.insert("userProjects", { userId, projectId });
    const person = { email: "x@example.test", isActive: true };
    const bothId = await ctx.db.insert("employees", { ...person, projectId, firstName: "Yüz", lastName: "Parmak", cardNumber: "1" });
    const noneId = await ctx.db.insert("employees", { ...person, projectId, firstName: "Boş", lastName: "Kişi", cardNumber: "2" });
    const foreignId = await ctx.db.insert("employees", { ...person, projectId: foreignProjectId, firstName: "Yabancı", lastName: "Proje", cardNumber: "3" });
    const pictureStorageId = await ctx.storage.store(new Blob(["face"]));
    await ctx.db.insert("employeeFaces", { employeeId: bothId, projectId, pictureStorageId, addedAt: 1 });
    const template = { encData: "enc", iv: "iv", keyVersion: "v1", addedAt: 1 };
    for (const fingerPrintID of [1, 2]) await ctx.db.insert("employeeFingerprints", { ...template, employeeId: bothId, projectId, fingerPrintID });
    await ctx.db.insert("employeeFingerprints", { ...template, employeeId: foreignId, projectId: foreignProjectId, fingerPrintID: 1 });
    return { projectId, foreignProjectId, adminId, adminSession, readerId, readerSession, bothId, noneId };
  });
  return {
    t,
    ids,
    admin: t.withIdentity({ subject: `${ids.adminId}|${ids.adminSession}` }),
    reader: t.withIdentity({ subject: `${ids.readerId}|${ids.readerSession}` }),
  };
}

describe("employeeBiometrics.summary", () => {
  it("F11 reads only visible people, including fingerprints beyond the old 5000-row cutoff", async () => {
    const { t, ids, admin } = await fixture();
    const target = await t.run(async ctx => {
      for (let i = 0; i < 5001; i++) await ctx.db.insert("employeeFingerprints", { projectId: ids.projectId, employeeId: ids.noneId, fingerPrintID: 1, encData: "enc", iv: "iv", keyVersion: "v1", addedAt: 1 });
      const employeeId = await ctx.db.insert("employees", { projectId: ids.projectId, firstName: "Son", lastName: "Kişi", email: "", cardNumber: "" });
      await ctx.db.insert("employeeFingerprints", { projectId: ids.projectId, employeeId, fingerPrintID: 9, encData: "enc", iv: "iv", keyVersion: "v1", addedAt: 1 });
      return employeeId;
    });
    expect(await admin.query(api.employeeBiometrics.summary, { projectId: ids.projectId, employeeIds: [target] })).toEqual([{ employeeId: target, face: false, fingerNos: [9] }]);
    expect(await admin.query(api.employeeBiometrics.summary, { projectId: ids.projectId, employeeIds: [] })).toEqual([]);
  });
  it("yöneticiye proje içi yüz + parmak numaralarını döner, şablon dönmez", async () => {
    const { ids, admin } = await fixture();
    const rows = await admin.query(api.employeeBiometrics.summary, { projectId: ids.projectId, employeeIds: [ids.bothId, ids.noneId] });
    expect(rows).toEqual([{ employeeId: ids.bothId, face: true, fingerNos: [1, 2] }]);
    expect(JSON.stringify(rows)).not.toContain("enc");
  });
  it("yönetici olmayana boş liste döner", async () => {
    const { ids, reader } = await fixture();
    expect(await reader.query(api.employeeBiometrics.summary, { projectId: ids.projectId, employeeIds: [ids.bothId, ids.noneId] })).toEqual([]);
  });
  it("erişimi olmayan projeyi reddeder", async () => {
    const { ids, admin } = await fixture();
    await expect(admin.query(api.employeeBiometrics.summary, { projectId: ids.foreignProjectId, employeeIds: [ids.bothId] })).rejects.toThrow();
  });
});

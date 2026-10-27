// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import type { ProjectRole } from "./lib/roleCatalog";

const modules = import.meta.glob("./**/*.ts");
const person = { firstName: "Ada", lastName: "Test", email: "ada@example.test", cardNumber: "12345" };
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

async function fixture(role: ProjectRole = "admin") {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "A" });
    const otherProjectId = await ctx.db.insert("projects", { name: "B" });
    const userId = await ctx.db.insert("users", { role: "project_user", verified: true });
    await ctx.db.insert("userProjects", { userId, projectId, role });
    const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 86400000 });
    return { projectId, otherProjectId, userId, sessionId };
  });
  const caller = t.withIdentity({ subject: `${ids.userId}|${ids.sessionId}` });
  return { t, caller, ...ids };
}

describe("şirketler (şubeler)", () => {
  it("aynı adla ikinci şirket açılmaz, başka projeye yazılamaz", async () => {
    const f = await fixture();
    await f.caller.mutation(api.companies.create, { projectId: f.projectId, name: " Gebze  Fabrika " });
    expect((await f.caller.query(api.companies.list, { projectId: f.projectId })).map(c => c.name)).toEqual(["Gebze Fabrika"]);
    await expect(f.caller.mutation(api.companies.create, { projectId: f.projectId, name: "gebze fabrika" })).rejects.toThrow("zaten var");
    await expect(f.caller.mutation(api.companies.create, { projectId: f.otherProjectId, name: "X" })).rejects.toThrow("yetkiniz yok");
  });

  it("bağlı departman ya da kişi varken silinmez", async () => {
    const f = await fixture();
    const companyId = await f.caller.mutation(api.companies.create, { projectId: f.projectId, name: "Merkez" });
    const departmentId = await f.caller.mutation(api.departments.create, { projectId: f.projectId, name: "Yönetim", companyId });
    await expect(f.caller.mutation(api.companies.remove, { companyId })).rejects.toThrow("bağlı kişi veya departman");
    await f.caller.mutation(api.departments.remove, { departmentId });
    await f.caller.mutation(api.employees.create, { ...person, projectId: f.projectId, companyId });
    await expect(f.caller.mutation(api.companies.remove, { companyId })).rejects.toThrow("bağlı kişi veya departman");
  });

  it("görüntüleyici rolü şirket ekleyemez", async () => {
    const f = await fixture("viewer");
    await expect(f.caller.mutation(api.companies.create, { projectId: f.projectId, name: "Merkez" })).rejects.toThrow("yetkiniz yok");
  });
});

describe("departman ↔ şirket", () => {
  it("üst seviye departman şirketsiz açılamaz", async () => {
    const f = await fixture();
    await expect(f.caller.mutation(api.departments.create, { projectId: f.projectId, name: "Yönetim" })).rejects.toThrow("şirket seçin");
  });

  it("alt departman üstünün şirketini alır, başka şirketin altına taşınamaz", async () => {
    const f = await fixture();
    const merkez = await f.caller.mutation(api.companies.create, { projectId: f.projectId, name: "Merkez" });
    const gebze = await f.caller.mutation(api.companies.create, { projectId: f.projectId, name: "Gebze" });
    const top = await f.caller.mutation(api.departments.create, { projectId: f.projectId, name: "Üretim", companyId: gebze });
    const child = await f.caller.mutation(api.departments.create, { projectId: f.projectId, name: "Kalite", parentId: top, companyId: merkez });
    expect((await f.t.run(ctx => ctx.db.get(child)))?.companyId).toBe(gebze);
    const other = await f.caller.mutation(api.departments.create, { projectId: f.projectId, name: "Yönetim", companyId: merkez });
    await expect(f.caller.mutation(api.departments.update, { departmentId: child, parentId: other })).rejects.toThrow("başka şirketin");
  });

  it("şirkete taşıma alt departmanları ve kişileri birlikte taşır", async () => {
    const f = await fixture();
    const gebze = await f.caller.mutation(api.companies.create, { projectId: f.projectId, name: "Gebze" });
    // Şirket zorunluluğundan önce açılmış şirketsiz departman.
    const top = await f.t.run(ctx => ctx.db.insert("departments", { projectId: f.projectId, name: "Yönetim" }));
    const child = await f.caller.mutation(api.departments.create, { projectId: f.projectId, name: "Muhasebe", parentId: top });
    const employeeId = await f.caller.mutation(api.employees.create, { ...person, projectId: f.projectId, departmentId: child });
    await expect(f.caller.mutation(api.departments.setCompany, { departmentId: child, companyId: gebze })).rejects.toThrow("üst seviye");
    await f.caller.mutation(api.departments.setCompany, { departmentId: top, companyId: gebze });
    const rows = await f.t.run(async ctx => [await ctx.db.get(top), await ctx.db.get(child), await ctx.db.get(employeeId)]);
    expect(rows.map(row => row?.companyId)).toEqual([gebze, gebze, gebze]);
  });

  it("kişinin şirketi departmanından gelir; çelişen şirket reddedilir", async () => {
    const f = await fixture();
    const merkez = await f.caller.mutation(api.companies.create, { projectId: f.projectId, name: "Merkez" });
    const gebze = await f.caller.mutation(api.companies.create, { projectId: f.projectId, name: "Gebze" });
    const uretim = await f.caller.mutation(api.departments.create, { projectId: f.projectId, name: "Üretim", companyId: gebze });
    const loose = await f.t.run(ctx => ctx.db.insert("departments", { projectId: f.projectId, name: "Genel" }));
    const employeeId = await f.caller.mutation(api.employees.create, { ...person, projectId: f.projectId, departmentId: uretim });
    expect((await f.t.run(ctx => ctx.db.get(employeeId)))?.companyId).toBe(gebze);
    await expect(f.caller.mutation(api.employees.update, { employeeId, companyId: merkez })).rejects.toThrow("başka şirkete ait");
    await expect(f.caller.mutation(api.employees.create, { ...person, email: "b@example.test", cardNumber: "B", projectId: f.projectId, departmentId: uretim, companyId: merkez })).rejects.toThrow("başka şirkete ait");
    await f.caller.mutation(api.employees.update, { employeeId, departmentId: loose, companyId: merkez });
    expect((await f.t.run(ctx => ctx.db.get(employeeId)))?.companyId).toBe(merkez);
  });
});

describe("pozisyonlar", () => {
  it("proje kapsamında listelenir ve bağlı kişi varken silinmez", async () => {
    const f = await fixture();
    const positionId = await f.caller.mutation(api.positions.create, { projectId: f.projectId, name: "Operatör" });
    await f.t.run(ctx => ctx.db.insert("positions", { projectId: f.otherProjectId, name: "Yabancı" }));
    expect((await f.caller.query(api.positions.list, { projectId: f.projectId })).map(p => p.name)).toEqual(["Operatör"]);
    await f.caller.mutation(api.positions.update, { positionId, name: "Usta" });
    const employeeId = await f.caller.mutation(api.employees.create, { ...person, projectId: f.projectId, positionId });
    await expect(f.caller.mutation(api.positions.remove, { positionId })).rejects.toThrow("bağlı kişi");
    await f.caller.mutation(api.employees.update, { employeeId, positionId: null });
    await f.caller.mutation(api.positions.remove, { positionId });
    expect(await f.caller.query(api.positions.list, { projectId: f.projectId })).toEqual([]);
  });
});

describe("Excel içe aktarma", () => {
  it("aynı departman adı iki şirkette varsa Firma ister, Firma ile doğru şirkete bağlar", async () => {
    const f = await fixture();
    const merkez = await f.caller.mutation(api.companies.create, { projectId: f.projectId, name: "Merkez" });
    const gebze = await f.caller.mutation(api.companies.create, { projectId: f.projectId, name: "Gebze" });
    await f.caller.mutation(api.departments.create, { projectId: f.projectId, name: "Üretim", companyId: merkez });
    const gebzeUretim = await f.caller.mutation(api.departments.create, { projectId: f.projectId, name: "Üretim", companyId: gebze });
    const row = { rowNumber: 2, firstName: "Ada", lastName: "Yılmaz", email: "ada@import.test", cardNumber: "IMP-1", department: "üretim" };
    expect(await f.caller.mutation(api.employeeImport.importChunk, { projectId: f.projectId, rows: [row], dryRun: true }))
      .toMatchObject([{ status: "error", message: expect.stringContaining("Firma sütununu") }]);
    await f.caller.mutation(api.employeeImport.importChunk, { projectId: f.projectId, rows: [{ ...row, company: "gebze" }], dryRun: false });
    const imported = await f.t.run(ctx => ctx.db.query("employees").withIndex("by_card", q => q.eq("cardNumber", "IMP-1")).unique());
    expect([imported?.departmentId, imported?.companyId]).toEqual([gebzeUretim, gebze]);
  });
});

// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { employeeWithinAccessEpoch } from "./lib/mobileAccess";
import { filterAndSortEmployees } from "../src/components/employees/lib/employeeList";
import { insertEmployee, patchEmployee } from "./lib/employeeListFields";

const modules = import.meta.glob("./**/*.ts");
async function fixture(role: "admin" | "hr" | "viewer" = "admin") {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "WC" });
    const userId = await ctx.db.insert("users", { role: "project_admin" });
    const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 86400000 });
    await ctx.db.insert("userProjects", { userId, projectId, role });
    return { projectId, userId, sessionId };
  });
  const caller = t.withIdentity({ subject: `${ids.userId}|${ids.sessionId}` });
  const add = (overrides: Partial<FunctionArgs<typeof api.employees.create>> = {}) => caller.mutation(api.employees.create, {
    projectId: ids.projectId, firstName: "Ada", lastName: "Test", email: "", cardNumber: "", ...overrides,
  });
  return { t, caller, ...ids, add };
}

describe("WC mutation corrections", () => {
  it("keeps import, batch card, termination/reinstatement and department-company moves indexed", async () => {
    const f = await fixture();
    const org = await f.t.run(async ctx => {
      const companyId = await ctx.db.insert("companies", { projectId: f.projectId, name: "A" });
      const targetCompanyId = await ctx.db.insert("companies", { projectId: f.projectId, name: "B" });
      const departmentId = await ctx.db.insert("departments", { projectId: f.projectId, name: "Üst", companyId });
      const childId = await ctx.db.insert("departments", { projectId: f.projectId, name: "Alt", parentId: departmentId, companyId });
      return { companyId, targetCompanyId, departmentId, childId };
    });
    const results = await f.caller.mutation(api.employeeImport.importChunk, { projectId: f.projectId, dryRun: false, rows: [
      { rowNumber: 2, firstName: "Zeynep", lastName: "Test", email: "", cardNumber: "", department: "Üst", company: "A" },
      { rowNumber: 3, firstName: "Ada", lastName: "Test", email: "", cardNumber: "", department: "Alt", company: "A" },
    ] });
    expect(results.map(row => row.status)).toEqual(["created", "created"]);
    const employees = await f.caller.query(api.employees.list, { projectId: f.projectId });
    const first = employees.find(row => row.firstName === "Zeynep");
    if (!first) throw new Error("Missing import");
    const original = await f.t.run(ctx => ctx.db.get(first._id));
    const page = () => f.caller.query(api.employees.listPage, { projectId: f.projectId, sort: "card:asc", paginationOpts: { cursor: null, numItems: 100 } });
    expect((await page()).legacy).toBe(false);
    await f.caller.mutation(api.employeeImport.assignCards, { assignments: [{ employeeId: first._id, cardNumber: "999" }] });
    const card = await f.t.run(ctx => ctx.db.get(first._id));
    expect(card?.listSearch).toContain("999");
    expect(card?.listKeys?.cardAsc).not.toBe(original?.listKeys?.cardAsc);
    await f.caller.mutation(api.employeeTermination.terminate, { employeeId: first._id, employmentEndDate: new Date(Date.now() - 86400000).toISOString().slice(0, 10), terminationType: "resignation" });
    const inactive = await f.t.run(ctx => ctx.db.get(first._id));
    expect(inactive?.isActive).toBe(false);
    expect(inactive?.listKeys?.statusAsc).not.toBe(card?.listKeys?.statusAsc);
    await f.caller.mutation(api.employeeTermination.reinstate, { employeeId: first._id });
    expect((await f.t.run(ctx => ctx.db.get(first._id)))?.listKeys?.statusAsc).toBe(card?.listKeys?.statusAsc);
    await f.caller.mutation(api.departments.setCompany, { departmentId: org.departmentId, companyId: org.targetCompanyId });
    const moved = await f.caller.query(api.employees.list, { projectId: f.projectId });
    expect(moved.every(row => row.companyId === org.targetCompanyId)).toBe(true);
    const movedKeys = await f.t.run(async ctx => Promise.all(moved.map(row => ctx.db.get(row._id))));
    expect(movedKeys.every(row => row?.listKeys?.companyAsc !== original?.listKeys?.companyAsc)).toBe(true);
    expect((await page()).legacy).toBe(false);
  });
  it("F03 moves company and department together and preserves the old history pair", async () => {
    const f = await fixture();
    const org = await f.t.run(async ctx => {
      const first = await ctx.db.insert("companies", { projectId: f.projectId, name: "A" });
      const second = await ctx.db.insert("companies", { projectId: f.projectId, name: "B" });
      const source = await ctx.db.insert("departments", { projectId: f.projectId, companyId: first, name: "Eski" });
      const target = await ctx.db.insert("departments", { projectId: f.projectId, companyId: second, name: "Yeni" });
      return { first, second, source, target };
    });
    const employeeId = await f.add({ companyId: org.first, departmentId: org.source });
    // Existing baseline at an earlier date must retain its original company.
    await f.t.run(async ctx => {
      for (const row of await ctx.db.query("employeeDepartmentHistory").collect()) await ctx.db.patch(row._id, { validFrom: "2026-01-01" });
    });
    await f.caller.mutation(api.employees.bulkUpdateDepartment, { employeeIds: [employeeId, employeeId], departmentId: org.target });
    expect(await f.t.run(ctx => ctx.db.get(employeeId))).toMatchObject({ departmentId: org.target, companyId: org.second });
    const history = await f.t.run(ctx => ctx.db.query("employeeDepartmentHistory").collect());
    expect(history).toEqual(expect.arrayContaining([
      expect.objectContaining({ departmentId: org.source, companyId: org.first }),
      expect.objectContaining({ departmentId: org.target, companyId: org.second }),
    ]));
  });

  it("F05 HR name changes enqueue Hik + IDE once; unchanged names and notes do not", async () => {
    const f = await fixture("hr");
    const employeeId = await f.add({ cardNumber: "123" });
    const before = await f.t.run(ctx => ctx.db.system.query("_scheduled_functions").collect());
    await f.caller.mutation(api.employees.update, { employeeId, lastName: "Yeni" });
    const after = await f.t.run(ctx => ctx.db.system.query("_scheduled_functions").collect());
    expect(after.slice(before.length).map(row => row.name)).toEqual([
      "actions/hikvisionSync:syncEmployeeToDevicesInternal", "actions/ideGatewayDevice:syncEmployeeToIdePanels",
    ]);
    await f.caller.mutation(api.employees.update, { employeeId, lastName: "Yeni", notes: "Not" });
    expect(await f.t.run(ctx => ctx.db.system.query("_scheduled_functions").collect())).toHaveLength(after.length);
  });

  it("F06 trims TC before create/update uniqueness checks and storage, and clears empty input", async () => {
    const f = await fixture();
    const employeeId = await f.add({ tcNo: " 10000000146 " });
    expect((await f.t.run(ctx => ctx.db.get(employeeId)))?.tcNo).toBe("10000000146");
    await expect(f.add({ tcNo: " 10000000146 " })).rejects.toThrow("başka bir personelde");
    const second = await f.add();
    await expect(f.caller.mutation(api.employees.update, { employeeId: second, tcNo: " 10000000146 " })).rejects.toThrow("başka bir personelde");
    await f.caller.mutation(api.employees.update, { employeeId, tcNo: " 10000000146 " });
    await f.caller.mutation(api.employees.update, { employeeId, tcNo: "   " });
    expect((await f.t.run(ctx => ctx.db.get(employeeId)))?.tcNo).toBeUndefined();
  });

  it("uses the shared card validator before writing an invalid physical card", async () => {
    const f = await fixture();
    for (const cardNumber of ["A B", "a".repeat(129), "1".repeat(21)]) await expect(f.add({ cardNumber })).rejects.toThrow(/[Kk]art numarası/);
    const employeeId = await f.add();
    await expect(f.caller.mutation(api.employees.update, { employeeId, cardNumber: "A B" })).rejects.toThrow("Kart numarası");
    expect((await f.t.run(ctx => ctx.db.get(employeeId)))?.cardNumber).toBe("");
  });

  it.each(["123", "456"])("D6: assigns a changed card and preserves an unchanged placeholder (%s)", async cardNumber => {
    const f = await fixture();
    const employeeId = await f.t.run(ctx => ctx.db.insert("employees", {
      projectId: f.projectId, firstName: "Cihaz", lastName: "Kartsız", email: "", cardNumber: "123", hikCardless: true, hikEmployeeNo: "person-7", isActive: true,
    }));
    await f.caller.mutation(api.employees.update, { employeeId, cardNumber });
    expect(await f.t.run(ctx => ctx.db.get(employeeId))).toMatchObject({ cardNumber, hikEmployeeNo: "person-7", hikCardless: cardNumber === "123" });
    const jobs = await f.t.run(ctx => ctx.db.system.query("_scheduled_functions").collect());
    expect(jobs.map(row => row.name)).toEqual(cardNumber === "123" ? [] : [
      "actions/hikvisionSync:syncEmployeeToDevicesInternal", "actions/ideGatewayDevice:syncEmployeeToIdePanels",
    ]);
  });

  it("supports employee expiry without changing visitor semantics or the imported instant", async () => {
    const f = await fixture();
    const accessExpiresAt = "2026-12-01T18:30:12+03:00";
    const employeeId = await f.add({ cardNumber: "123", accessStartsAt: "2026-12-01T00:00:00+03:00", accessExpiresAt });
    const employee = await f.t.run(ctx => ctx.db.get(employeeId));
    expect(employee?.accessExpiresAt).toBe("2026-12-01T15:30:12.000Z");
    if (!employee) throw new Error("Missing employee");
    expect(employeeWithinAccessEpoch(employee, Date.parse(accessExpiresAt) + 1)).toBe(false);
    await f.caller.mutation(api.employees.update, { employeeId, notes: "Sadece not" });
    expect((await f.t.run(ctx => ctx.db.get(employeeId)))?.accessExpiresAt).toBe(employee.accessExpiresAt);
    await expect(f.caller.mutation(api.employees.update, { employeeId, accessExpiresAt: "2026-11-30T00:00:00Z" })).rejects.toThrow("başlangıçtan önce");
    await f.caller.mutation(api.employees.update, { employeeId, accessExpiresAt: null });
    expect((await f.t.run(ctx => ctx.db.get(employeeId)))?.accessExpiresAt).toBeUndefined();
    const visitorId = await f.t.run(ctx => ctx.db.insert("employees", { projectId: f.projectId, firstName: "Visitor", lastName: "A", email: "", cardNumber: "", isVisitor: true, accessExpiresAt: employee.accessExpiresAt }));
    await expect(f.caller.mutation(api.employees.update, { employeeId: visitorId, accessExpiresAt: null })).rejects.toThrow("Ziyaretçi");
    expect((await f.t.run(ctx => ctx.db.get(visitorId)))?.accessExpiresAt).toBe(employee.accessExpiresAt);
  });
});

describe("WC server list pagination", () => {
  it("keeps visible organization labels accurate beyond the bounded organization catalog", async () => {
    const f = await fixture();
    const departmentId = await f.t.run(async ctx => {
      const ids = [];
      for (let i = 0; i < 1002; i++) ids.push(await ctx.db.insert("departments", { projectId: f.projectId, name: `Bölüm ${i}` }));
      return ids[1001];
    });
    await f.add({ departmentId });
    const args = { projectId: f.projectId, paginationOpts: { cursor: null, numItems: 10 } };
    const result = await f.caller.query(api.employees.listPage, args);
    expect(result.legacy).toBe(false);
    expect(result.page[0].departments?.name).toBe("Bölüm 1001");
    expect(result.page[0]).not.toHaveProperty("listKeys");
    expect(result.page[0]).not.toHaveProperty("deviceSyncUpdatedAt");
    await expect(f.caller.query(api.employees.listPage, { ...args, sort: "department:asc" })).rejects.toThrow("1000");
  });
  it("D1 sorts current organization names without rewriting keys or falling back after organization changes", async () => {
    const f = await fixture();
    const org = await f.t.run(async ctx => {
      const a = await ctx.db.insert("companies", { projectId: f.projectId, name: "A" });
      const z = await ctx.db.insert("companies", { projectId: f.projectId, name: "Z" });
      const departments = [];
      for (const [name, companyId] of [["Kat 10", a], ["Kat 2", z], ["Kat 02", a]] as const) departments.push(await ctx.db.insert("departments", { projectId: f.projectId, name, companyId }));
      const positionA = await ctx.db.insert("positions", { projectId: f.projectId, name: "Analist" });
      const positionZ = await ctx.db.insert("positions", { projectId: f.projectId, name: "Uzman" });
      return { a, z, departments, positionA, positionZ };
    });
    for (const [i, departmentId] of org.departments.entries()) await f.add({ firstName: `Kişi ${i}`, departmentId, positionId: i === 0 ? org.positionA : org.positionZ });
    const keysBefore = await f.t.run(async ctx => (await ctx.db.query("employees").collect()).map(row => row.listKeys));
    const verify = async () => {
      const all = await f.caller.query(api.employees.list, { projectId: f.projectId });
      for (const field of ["company", "department", "position"]) for (const direction of ["asc", "desc"]) {
        let cursor: string | null = null;
        const ids: string[] = [];
        for (let page = 0; page < 5; page++) {
          const result: FunctionReturnType<typeof api.employees.listPage> = await f.caller.query(api.employees.listPage, { projectId: f.projectId, sort: `${field}:${direction}`, paginationOpts: { cursor, numItems: 1 } });
          expect(result.legacy).toBe(false);
          ids.push(...result.page.map(row => row._id));
          if (result.isDone) break;
          cursor = result.continueCursor;
        }
        expect(ids).toEqual(filterAndSortEmployees(all, "", "", "all", `${field}:${direction}`).map(row => row._id));
      }
    };
    await verify();
    await f.caller.mutation(api.companies.update, { companyId: org.z, name: "0 Yeni" });
    await f.caller.mutation(api.positions.update, { positionId: org.positionZ, name: "0 Uzman" });
    await f.caller.mutation(api.departments.update, { departmentId: org.departments[0], name: "Kat 1" });
    await f.caller.mutation(api.departments.create, { projectId: f.projectId, companyId: org.a, name: "Boş bölüm" });
    await f.caller.mutation(api.companies.create, { projectId: f.projectId, name: "Boş şirket" });
    await f.caller.mutation(api.positions.create, { projectId: f.projectId, name: "Boş pozisyon" });
    await verify();
    expect(await f.t.run(async ctx => (await ctx.db.query("employees").collect()).map(row => row.listKeys))).toEqual(keysBefore);
    expect((await f.caller.query(api.employees.listSummary, { projectId: f.projectId })).modeToken).toBe("indexed:2");
  });

  it("D3 fills sparse filtered pages server-side and advances after its bounded scan budget", async () => {
    const f = await fixture();
    await f.t.run(async ctx => {
      for (let i = 0; i < 2100; i++) await insertEmployee(ctx, { projectId: f.projectId, firstName: `A ${i}`, lastName: "Test", email: "", cardNumber: "", isActive: false });
      for (let i = 0; i < 5; i++) await insertEmployee(ctx, { projectId: f.projectId, firstName: `Z ${i}`, lastName: "Needle", email: "", cardNumber: "", isActive: true });
      for (let i = 0; i < 100; i++) await insertEmployee(ctx, { projectId: f.projectId, firstName: "A Visitor", lastName: "Needle", email: "", cardNumber: "", isActive: true, isVisitor: true });
    });
    const args = { projectId: f.projectId, search: "needle", status: "active", paginationOpts: { cursor: null, numItems: 5 } };
    const first = await f.caller.query(api.employees.listPage, args);
    expect(first.page).toEqual([]);
    expect(first.isDone).toBe(false);
    const second = await f.caller.query(api.employees.listPage, { ...args, paginationOpts: { ...args.paginationOpts, cursor: first.continueCursor } });
    expect(second.page).toHaveLength(5);
    expect(second.page.every(row => row.lastName === "Needle" && row.isActive && !row.isVisitor)).toBe(true);
  }, 15000);

  it("D10 excludes visits from bounded employee counts and import matching", async () => {
    const f = await fixture();
    await f.add();
    await f.t.run(async ctx => {
      for (let i = 0; i < 2001; i++) await insertEmployee(ctx, { projectId: f.projectId, firstName: "Visitor", lastName: "Test", email: "", cardNumber: "", isVisitor: true });
    });
    expect((await f.caller.query(api.employees.listSummary, { projectId: f.projectId })).counts?.all).toBe(1);
    expect(await f.caller.query(api.employees.listLightForImport, { projectId: f.projectId })).toHaveLength(1);
  });
  it("subscribes to one bounded page window with explicit forward/backward cursors", async () => {
    const f = await fixture();
    for (const firstName of ["A", "B", "C", "D", "E"]) await f.add({ firstName });
    const args = { projectId: f.projectId, sort: "name:desc", pageSize: 2, startCursor: null, paginationOpts: { cursor: null, numItems: 1 } };
    const first = await f.caller.query(api.employees.listPageWindow, args);
    expect(first.page).toHaveLength(1);
    expect(first.page[0].page.map(row => row.firstName)).toEqual(["E", "D"]);
    const cursor = first.page[0].continueCursor;
    const second = await f.caller.query(api.employees.listPageWindow, { ...args, startCursor: cursor });
    expect(second.page[0].page.map(row => row.firstName)).toEqual(["C", "B"]);
    await f.add({ firstName: "Z" });
    // The current page never concatenates a shifted first page with the old second page.
    expect((await f.caller.query(api.employees.listPageWindow, { ...args, startCursor: cursor })).page[0].page.map(row => row.firstName)).toEqual(["C", "B"]);
    expect((await f.caller.query(api.employees.listPageWindow, args)).page[0].page.map(row => row.firstName)).toEqual(["Z", "E"]);
  });
  it.each(["name", "email", "company", "department", "position", "card", "status"])("F09 preserves %s order and ID ties across asc/desc page boundaries", async field => {
    const f = await fixture();
    for (const [i, firstName] of ["İpek", "Işık", "Ada 10", "Ada 2", "Ada 002", "Ada 2", "Çiğdem", "Zeynep"].entries()) {
      await f.add({ firstName, email: `a${i}@example.test`, cardNumber: String(i + 1), isActive: i % 2 === 0 });
    }
    const all = await f.caller.query(api.employees.list, { projectId: f.projectId });
    for (const direction of ["asc", "desc"]) {
      const ids: string[] = [];
      let cursor: string | null = null;
      for (let n = 0; n < 10; n++) {
        const result: FunctionReturnType<typeof api.employees.listPage> = await f.caller.query(api.employees.listPage, { projectId: f.projectId, sort: `${field}:${direction}`, paginationOpts: { cursor, numItems: 3 } });
        expect(result.legacy).toBe(false);
        ids.push(...result.page.map(row => row._id));
        if (result.isDone) break;
        cursor = result.continueCursor;
      }
      expect(ids).toEqual(filterAndSortEmployees(all, "", "", "all", `${field}:${direction}`).map(row => row._id));
      expect(new Set(ids).size).toBe(all.length);
    }
  });

  it("F09 filters Turkish search, descendants, company and employment status on the server", async () => {
    const f = await fixture();
    const org = await f.t.run(async ctx => {
      const companyId = await ctx.db.insert("companies", { projectId: f.projectId, name: "B" });
      const parent = await ctx.db.insert("departments", { projectId: f.projectId, name: "Üst", companyId });
      const child = await ctx.db.insert("departments", { projectId: f.projectId, name: "Alt", parentId: parent, companyId });
      return { companyId, parent, child };
    });
    const parentId = await f.add({ firstName: "IŞIK", departmentId: org.parent });
    const childId = await f.add({ firstName: "IŞIK", departmentId: org.child });
    await f.add({ firstName: "IŞIK", departmentId: org.child, isActive: false });
    const args = { projectId: f.projectId, search: "ışık", company: org.companyId, department: org.parent, status: "active", paginationOpts: { cursor: null, numItems: 100 } };
    expect((await f.caller.query(api.employees.listPage, args)).page.map(row => row._id)).toEqual([parentId]);
    expect((await f.caller.query(api.employees.listPage, { ...args, includeChildren: true })).page.map(row => row._id).sort()).toEqual([parentId, childId].sort());
  });

  it("F09 keeps legacy records visible and keeps indexed mode after org/Unicode changes", async () => {
    const f = await fixture();
    const companyId = await f.t.run(ctx => ctx.db.insert("companies", { projectId: f.projectId, name: "A" }));
    const id = await f.t.run(ctx => ctx.db.insert("employees", { projectId: f.projectId, firstName: "Legacy", lastName: "Kişi", email: "", cardNumber: "", companyId }));
    const args = { projectId: f.projectId, paginationOpts: { cursor: null, numItems: 10 } };
    expect((await f.caller.query(api.employees.listPage, args)).legacy).toBe(true);
    const backfill = await f.t.mutation(internal.employees.backfillListFields, { projectId: f.projectId, paginationOpts: { cursor: null, numItems: 1 } });
    expect(backfill.updated).toBe(1);
    expect((await f.caller.query(api.employees.listPage, args)).legacy).toBe(false);
    await f.t.run(ctx => ctx.db.patch(companyId, { name: "Yeni" }));
    const renamed = await f.caller.query(api.employees.listPage, args);
    expect(renamed.legacy).toBe(false);
    expect(renamed.page[0].companies?.name).toBe("Yeni");
    await f.caller.mutation(api.employees.update, { employeeId: id, notes: "Yenile" });
    expect((await f.caller.query(api.employees.listPage, args)).legacy).toBe(false);
    await f.add({ firstName: "Zoë" });
    expect((await f.caller.query(api.employees.listPage, args)).legacy).toBe(false);
  });

  it("returns bounded counts for small projects and unknown counts beyond 2000", async () => {
    const f = await fixture();
    await f.add();
    await f.add({ isActive: false });
    expect((await f.caller.query(api.employees.listSummary, { projectId: f.projectId })).counts).toEqual({ all: 2, active: 1, inactive: 1, terminated: 0 });
    await f.t.run(async ctx => {
      for (let i = 0; i < 1999; i++) await ctx.db.insert("employees", { projectId: f.projectId, firstName: "A", lastName: "B", email: "", cardNumber: "" });
    });
    expect((await f.caller.query(api.employees.listSummary, { projectId: f.projectId })).counts).toBeNull();
    await expect(f.caller.query(api.employees.listLightForImport, { projectId: f.projectId })).rejects.toThrow("2000");
  });

  it("preserves project scope and filters visitors from the new page query", async () => {
    const f = await fixture("viewer");
    const employeeId = await f.t.run(ctx => ctx.db.insert("employees", { projectId: f.projectId, firstName: "Ziyaretçi", lastName: "A", email: "", cardNumber: "", isVisitor: true }));
    expect((await f.caller.query(api.employees.listPage, { projectId: f.projectId, paginationOpts: { cursor: null, numItems: 100 } })).page).toEqual([]);
    const foreign = await f.t.run(ctx => ctx.db.insert("projects", { name: "Yabancı" }));
    await expect(f.caller.query(api.employees.listPage, { projectId: foreign, paginationOpts: { cursor: null, numItems: 100 } })).rejects.toThrow();
    await expect(f.caller.mutation(api.employees.update, { employeeId, accessExpiresAt: null })).rejects.toThrow();
  });
});

it("D9: employee writes advance device freshness only for device fields and freeze legacy updatedAt", async () => {
  const f = await fixture();
  const employeeId = await f.add();
  await f.t.run(ctx => ctx.db.patch(employeeId, { deviceSyncUpdatedAt: 123, updatedAt: new Date(2000).toISOString() }));
  await f.caller.mutation(api.employees.update, { employeeId, notes: "new note", payrollCode: "PAY" });
  expect(await f.t.run(ctx => ctx.db.get(employeeId))).toMatchObject({ deviceSyncUpdatedAt: 123 });
  await f.caller.mutation(api.employees.update, { employeeId, firstName: "Changed" });
  expect((await f.t.run(ctx => ctx.db.get(employeeId)))?.deviceSyncUpdatedAt).toBeGreaterThan(123);
  await f.t.run(ctx => ctx.db.patch(employeeId, { deviceSyncUpdatedAt: undefined, updatedAt: new Date(2000).toISOString() }));
  await f.t.run(ctx => patchEmployee(ctx, employeeId, { notes: "legacy note", updatedAt: new Date().toISOString() }));
  expect(await f.t.run(ctx => ctx.db.get(employeeId))).toMatchObject({ deviceSyncUpdatedAt: 2000 });
  await f.caller.mutation(api.employeeImport.assignCards, { assignments: [{ employeeId, cardNumber: "987654" }] });
  expect((await f.t.run(ctx => ctx.db.get(employeeId)))?.deviceSyncUpdatedAt).toBeGreaterThan(2000);
});

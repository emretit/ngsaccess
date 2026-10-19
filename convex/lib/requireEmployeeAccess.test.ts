import { describe, expect, it } from "vitest";
import type { Doc, Id } from "../_generated/dataModel";
import { canAccessEmployeeProject, requireEmployeeAccess } from "./auth";

type TestCtx = Parameters<typeof requireEmployeeAccess>[0];

function makeCtx(role: Doc<"users">["role"], memberOf: string[], employee: { projectId?: string } | null): TestCtx {
  const ctx = {
    user: { _id: "user-1", role },
    db: {
      get: async () => employee,
      query: () => ({
        withIndex: () => ({ collect: async () => memberOf.map((projectId) => ({ projectId })) }),
      }),
    },
  };
  return ctx as unknown as TestCtx;
}

const employeeId = "employee-1" as Id<"employees">;

describe("requireEmployeeAccess", () => {
  it("süper admin her çalışana ve projesiz çalışana erişir", async () => {
    await expect(requireEmployeeAccess(makeCtx("super_admin", [], { projectId: "b" }), employeeId)).resolves.toBeTruthy();
    await expect(requireEmployeeAccess(makeCtx("super_admin", [], {}), employeeId)).resolves.toBeTruthy();
  });

  it.each(["project_admin", "project_user"] as const)("%s yalnız üyesi olduğu projedeki çalışana erişir", async (role) => {
    await expect(requireEmployeeAccess(makeCtx(role, ["a"], { projectId: "a" }), employeeId)).resolves.toBeTruthy();
    await expect(requireEmployeeAccess(makeCtx(role, ["a"], { projectId: "b" }), employeeId)).rejects.toThrow("erişim yetkiniz yok");
  });

  it("süper admin olmayan kullanıcı projesiz çalışana erişemez", async () => {
    await expect(requireEmployeeAccess(makeCtx("project_user", ["a"], {}), employeeId)).rejects.toThrow("erişim yetkiniz yok");
    await expect(requireEmployeeAccess(makeCtx("project_admin", ["a"], {}), employeeId)).rejects.toThrow("erişim yetkiniz yok");
  });

  it("çalışan yoksa hata verir", async () => {
    await expect(requireEmployeeAccess(makeCtx("super_admin", [], null), employeeId)).rejects.toThrow("Çalışan bulunamadı");
  });
});

describe("canAccessEmployeeProject", () => {
  const projectA = "a" as Id<"projects">;
  const projectB = "b" as Id<"projects">;

  it("süper admin projesiz çalışana ve her projeye erişir", () => {
    expect(canAccessEmployeeProject("super_admin", [projectA], undefined)).toBe(true);
    expect(canAccessEmployeeProject("super_admin", [projectA], projectB)).toBe(true);
  });

  it.each(["project_admin", "project_user"] as const)("%s projesiz çalışana erişemez", (role) => {
    expect(canAccessEmployeeProject(role, [projectA], undefined)).toBe(false);
    expect(canAccessEmployeeProject(role, [], undefined)).toBe(false);
  });

  it.each(["project_admin", "project_user"] as const)("%s yalnız üyesi olduğu projedeki çalışana erişir", (role) => {
    expect(canAccessEmployeeProject(role, [projectA], projectA)).toBe(true);
    expect(canAccessEmployeeProject(role, [projectA], projectB)).toBe(false);
  });
});

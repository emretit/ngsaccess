// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import rateLimiterTest from "@convex-dev/rate-limiter/test";
import bcrypt from "bcryptjs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const currentPassword = "Synthetic-Current-2026";
const newPassword = "Synthetic-Replacement-2026";
const currentHash = bcrypt.hashSync(currentPassword, 4);
const newHash = bcrypt.hashSync(newPassword, 4);
const now = "2026-10-19T12:00:00.000Z";

function createTest() {
  const t = convexTest(schema, modules);
  rateLimiterTest.register(t);
  return t;
}

async function fixture(options: { version?: number; sessionVersion?: number; active?: boolean; expiresAt?: string } = {}) {
  vi.stubEnv("MOBILE_IDE_ISOLATION_VERIFIED", "true");
  const t = createTest();
  const ids = await t.run(async (ctx) => {
    const employeeId = await ctx.db.insert("employees", {
      firstName: "Synthetic", lastName: "Employee", email: "mobile@example.test",
      cardNumber: "synthetic-card", isActive: options.active ?? true,
    });
    const otherEmployeeId = await ctx.db.insert("employees", {
      firstName: "Other", lastName: "Employee", email: "other@example.test", cardNumber: "other-card",
    });
    const authId = await ctx.db.insert("employeeAuth", {
      employeeId, passwordHash: currentHash, passwordVersion: options.version,
      setupToken: "synthetic-setup", tokenExpiresAt: "2030-01-01T00:00:00.000Z",
      createdAt: now, updatedAt: now,
    });
    await ctx.db.insert("employeeAuth", { employeeId: otherEmployeeId, passwordHash: currentHash, createdAt: now, updatedAt: now });
    for (const token of ["device-one", "device-two"]) {
      await ctx.db.insert("employeeSessions", {
        employeeId, token, passwordVersion: options.sessionVersion,
        expiresAt: options.expiresAt ?? "2030-01-01T00:00:00.000Z", createdAt: now,
      });
    }
    await ctx.db.insert("employeeSessions", {
      employeeId: otherEmployeeId, token: "other-session", expiresAt: "2030-01-01T00:00:00.000Z", createdAt: now,
    });
    return { employeeId, otherEmployeeId, authId };
  });
  return { t, ...ids };
}

afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

describe("mobile auth with the real session wrapper and persisted rate limiter", () => {
  it("commits wrong-password attempts, normalizes bucket keys, and recovers after refill", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(now));
    const { t, employeeId } = await fixture();
    for (let attempt = 0; attempt < 5; attempt++) {
      await expect(t.mutation(api.employeeAuth.signIn, {
        email: attempt % 2 ? " MOBILE@EXAMPLE.TEST " : "mobile@example.test", password: "incorrect",
      })).resolves.toEqual({ error: { code: "INVALID_CREDENTIALS", message: "E-posta veya şifre hatalı" } });
    }
    const limited = await t.mutation(api.employeeAuth.signIn, { email: "mobile@example.test", password: currentPassword });
    expect(limited).toMatchObject({ error: { code: "RATE_LIMITED", retryAfterMs: 180000 } });
    await expect(t.run(async (ctx) => ctx.db.query("employeeSessions").take(10))).resolves.toHaveLength(3);
    vi.advanceTimersByTime(180000);
    const fresh = await t.mutation(api.employeeAuth.signIn, { email: "mobile@example.test", password: currentPassword });
    if ("error" in fresh) throw new Error("Refilled valid sign-in failed");
    expect(fresh.employee).toMatchObject({ id: employeeId, projectId: null, projectName: null, departmentId: null, photoUrl: null });
    expect(Object.keys(fresh.employee).sort()).toEqual(["id", "projectId", "projectName", "firstName", "lastName", "email", "photoUrl", "departmentId", "cardNumber"].sort());
    await expect(t.query(api.employeeAuth.me, { sessionToken: fresh.token })).resolves.toMatchObject({ id: employeeId });
  });

  it("returns only the mobile employee's canonical project for sign-in and restore", async () => {
    const { t, employeeId } = await fixture();
    const projectId = await t.run(async ctx => {
      const projectId = await ctx.db.insert("projects", { name: "Mobile project" });
      const foreignProjectId = await ctx.db.insert("projects", { name: "Web project" });
      const webUserId = await ctx.db.insert("users", { email: "mobile@example.test", role: "project_admin" });
      await ctx.db.insert("userProjects", { userId: webUserId, projectId: foreignProjectId });
      const departmentId = await ctx.db.insert("departments", { name: "Different department", projectId });
      await ctx.db.patch(employeeId, { projectId, departmentId });
      return projectId;
    });
    const result = await t.mutation(api.employeeAuth.signIn, { email: "mobile@example.test", password: currentPassword });
    if ("error" in result) throw new Error("Valid mobile sign-in failed");
    expect(result.employee).toMatchObject({ projectId, projectName: "Mobile project" });
    await expect(t.query(api.employeeAuth.me, { sessionToken: result.token }))
      .resolves.toMatchObject({ projectId, projectName: "Mobile project", departmentName: "Different department" });
    await t.run(ctx => ctx.db.patch(projectId, { name: "Renamed mobile project" }));
    await expect(t.query(api.employeeAuth.me, { sessionToken: result.token }))
      .resolves.toMatchObject({ projectName: "Renamed mobile project" });
    await t.run(ctx => ctx.db.delete(projectId));
    await expect(t.query(api.employeeAuth.me, { sessionToken: result.token }))
      .resolves.toMatchObject({ projectName: null });
    const orphanResult = await t.mutation(api.employeeAuth.signIn, { email: "mobile@example.test", password: currentPassword });
    if ("error" in orphanResult) throw new Error("Orphan-compatible sign-in changed unexpectedly");
    expect(orphanResult.employee.projectName).toBeNull();
  });

  it("uses the same result and persistent quota for absent accounts", async () => {
    const t = createTest();
    for (let attempt = 0; attempt < 5; attempt++) {
      await expect(t.mutation(api.employeeAuth.signIn, { email: "missing@example.test", password: "incorrect" }))
        .resolves.toEqual({ error: { code: "INVALID_CREDENTIALS", message: "E-posta veya şifre hatalı" } });
    }
    await expect(t.mutation(api.employeeAuth.signIn, { email: " MISSING@EXAMPLE.TEST ", password: "incorrect" }))
      .resolves.toMatchObject({ error: { code: "RATE_LIMITED" } });
    await expect(t.mutation(api.employeeAuth.signIn, { email: "another@example.test", password: "incorrect" }))
      .resolves.toMatchObject({ error: { code: "INVALID_CREDENTIALS" } });
  });

  it("does not disclose an inactive account through credential errors", async () => {
    const { t } = await fixture({ active: false });
    await expect(t.mutation(api.employeeAuth.signIn, { email: "mobile@example.test", password: currentPassword }))
      .resolves.toEqual({ error: { code: "INVALID_CREDENTIALS", message: "E-posta veya şifre hatalı" } });
  });

  it.each(["missing-auth", "missing-password"] as const)("returns generic credentials for $0", async (kind) => {
    const { t, authId } = await fixture();
    await t.run(async (ctx) => {
      if (kind === "missing-auth") await ctx.db.delete(authId);
      else await ctx.db.patch(authId, { passwordHash: undefined });
    });
    await expect(t.mutation(api.employeeAuth.signIn, { email: "mobile@example.test", password: currentPassword }))
      .resolves.toEqual({ error: { code: "INVALID_CREDENTIALS", message: "E-posta veya şifre hatalı" } });
  });

  it("caps simultaneous attempts at the same persisted account quota", async () => {
    const t = createTest();
    const results = await Promise.all(Array.from({ length: 8 }, () => t.mutation(api.employeeAuth.signIn, {
      email: "concurrent@example.test", password: "incorrect",
    })));
    expect(results.filter((result) => result.error?.code === "INVALID_CREDENTIALS")).toHaveLength(5);
    expect(results.filter((result) => result.error?.code === "RATE_LIMITED")).toHaveLength(3);
  });

  it.each(["setup", "internal-update", "admin-update"] as const)("%s revokes both legacy devices and leaves another employee valid", async (path) => {
    const { t, authId, otherEmployeeId } = await fixture();
    await expect(t.query(api.employeeAuth.me, { sessionToken: "device-one" })).resolves.toBeDefined();
    if (path === "setup") {
      await expect(t.mutation(internal.employeeAuth.consumeSetupToken, { token: "synthetic-setup", passwordHash: newHash }))
        .resolves.toEqual({ status: "ok" });
    } else if (path === "internal-update") {
      await t.mutation(internal.employeeAuth.update, { authId, passwordHash: newHash });
    } else {
      await t.mutation(internal.employees.updateAuthPasswordInternal, { authId, passwordHash: newHash });
    }
    await expect(t.query(api.employeeAuth.me, { sessionToken: "device-one" }))
      .rejects.toMatchObject({ data: { code: "SESSION_REVOKED" } });
    await expect(t.mutation(api.employeeAuth.changePassword, { sessionToken: "device-two", currentPassword, newPassword }))
      .rejects.toMatchObject({ data: { code: "SESSION_REVOKED" } });
    await expect(t.query(api.employeeAuth.me, { sessionToken: "other-session" })).resolves.toMatchObject({ id: otherEmployeeId });
    const fresh = await t.mutation(api.employeeAuth.signIn, { email: "mobile@example.test", password: newPassword });
    if ("error" in fresh) throw new Error("Fresh sign-in failed after password change");
    await expect(t.query(api.employeeAuth.me, { sessionToken: fresh.token })).resolves.toBeDefined();
    await expect(t.run((ctx) => ctx.db.get(authId))).resolves.toMatchObject({ passwordVersion: 1 });
  });

  it("invalidates versioned sessions after a second password write", async () => {
    const { t, authId } = await fixture({ version: 7, sessionVersion: 7 });
    await t.mutation(internal.employees.updateAuthPasswordInternal, { authId, passwordHash: newHash });
    await expect(t.query(api.employeeAuth.me, { sessionToken: "device-one" })).rejects.toMatchObject({ data: { code: "SESSION_REVOKED" } });
    await expect(t.run((ctx) => ctx.db.get(authId))).resolves.toMatchObject({ passwordVersion: 8 });
  });

  it("does not revoke sessions when only auth contact metadata changes", async () => {
    const { t, authId } = await fixture();
    await t.mutation(internal.employeeAuth.update, { authId, email: "updated@example.test" });
    await expect(t.query(api.employeeAuth.me, { sessionToken: "device-one" })).resolves.toBeDefined();
    await expect(t.run((ctx) => ctx.db.get(authId))).resolves.not.toHaveProperty("passwordVersion");
  });

  it("new admin credentials do not reactivate orphan legacy sessions", async () => {
    const { t, authId, employeeId } = await fixture();
    await t.run((ctx) => ctx.db.delete(authId));
    await expect(t.query(api.employeeAuth.me, { sessionToken: "device-one" })).rejects.toMatchObject({ data: { code: "SESSION_REVOKED" } });
    await t.mutation(internal.employees.createAuthInternal, { employeeId, passwordHash: newHash });
    await expect(t.query(api.employeeAuth.me, { sessionToken: "device-one" })).rejects.toMatchObject({ data: { code: "SESSION_REVOKED" } });
    await expect(t.mutation(api.employeeAuth.signIn, { email: "mobile@example.test", password: newPassword })).resolves.toHaveProperty("token");
  });

  it("hash retirement increments the revision and can resume after a bounded page", async () => {
    const { t, authId, employeeId } = await fixture();
    await t.run(async (ctx) => {
      await ctx.db.patch(authId, { passwordHash: "synthetic-legacy-hash" });
      for (let row = 0; row < 100; row++) {
        await ctx.db.insert("employeeAuth", { employeeId, passwordHash: currentHash, createdAt: now, updatedAt: now });
      }
    });
    const first = await t.mutation(internal.employeeAuth.wipeLegacyHashes, {});
    expect(first).toMatchObject({ wiped: 1, isDone: false });
    await expect(t.mutation(internal.employeeAuth.wipeLegacyHashes, { cursor: first.continueCursor })).resolves.toMatchObject({ wiped: 0, isDone: true });
    const retired = await t.run((ctx) => ctx.db.get(authId));
    expect(retired).toMatchObject({ passwordVersion: 1 });
    expect(retired).not.toHaveProperty("passwordHash");
    await expect(t.query(api.employeeAuth.me, { sessionToken: "device-one" })).rejects.toMatchObject({ data: { code: "SESSION_REVOKED" } });
  });

  it.each([undefined, "not-a-date", now])("fails closed for a setup token without a future valid expiry", async (tokenExpiresAt) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(now));
    const { t, authId } = await fixture();
    await t.run((ctx) => ctx.db.patch(authId, { tokenExpiresAt }));
    await expect(t.mutation(internal.employeeAuth.consumeSetupToken, { token: "synthetic-setup", passwordHash: newHash })).resolves.toEqual({ status: "expired" });
    await expect(t.run((ctx) => ctx.db.get(authId))).resolves.toMatchObject({ passwordHash: currentHash });
  });

  it("persists failed current-password quota without revoking the valid session", async () => {
    const { t } = await fixture();
    for (let attempt = 0; attempt < 5; attempt++) {
      await expect(t.mutation(api.employeeAuth.changePassword, { sessionToken: "device-one", currentPassword: "incorrect", newPassword }))
        .resolves.toMatchObject({ error: { code: "INVALID_CREDENTIALS" } });
    }
    await expect(t.mutation(api.employeeAuth.changePassword, { sessionToken: "device-two", currentPassword, newPassword }))
      .resolves.toMatchObject({ error: { code: "RATE_LIMITED" } });
    await expect(t.query(api.employeeAuth.me, { sessionToken: "device-one" })).resolves.toBeDefined();
  });

  it("requires re-login after an authenticated own-password change", async () => {
    const { t, otherEmployeeId } = await fixture();
    await expect(t.mutation(api.employeeAuth.changePassword, { sessionToken: "device-one", currentPassword: "incorrect", newPassword }))
      .resolves.toMatchObject({ error: { code: "INVALID_CREDENTIALS" } });
    await expect(t.mutation(api.employeeAuth.changePassword, { sessionToken: "device-one", currentPassword, newPassword }))
      .resolves.toEqual({ requiresSignIn: true });
    for (const sessionToken of ["device-one", "device-two"]) {
      await expect(t.query(api.employeeAuth.me, { sessionToken })).rejects.toMatchObject({ data: { code: "SESSION_REVOKED" } });
    }
    await expect(t.mutation(api.employeeAuth.signIn, { email: "mobile@example.test", password: currentPassword }))
      .resolves.toMatchObject({ error: { code: "INVALID_CREDENTIALS" } });
    const fresh = await t.mutation(api.employeeAuth.signIn, { email: "mobile@example.test", password: newPassword });
    expect(fresh).toHaveProperty("token");
    await expect(t.query(api.employeeAuth.me, { sessionToken: "other-session" })).resolves.toMatchObject({ id: otherEmployeeId });
  });

  it.each(["Short1", "lowercase-only-2026", "Aa1" + "a".repeat(70), "Aa1" + "🔒".repeat(18), currentPassword])("rejects unsafe replacement password without changing auth", async (newPassword) => {
    const { t, authId } = await fixture();
    await expect(t.mutation(api.employeeAuth.changePassword, { sessionToken: "device-one", currentPassword, newPassword }))
      .resolves.toMatchObject({ error: { code: "PASSWORD_POLICY" } });
    await expect(t.run((ctx) => ctx.db.get(authId))).resolves.toMatchObject({ passwordHash: currentHash });
    await expect(t.query(api.employeeAuth.me, { sessionToken: "device-one" })).resolves.toBeDefined();
  });

  it.each([
    { options: { expiresAt: now }, code: "SESSION_EXPIRED" },
    { options: { expiresAt: "not-a-date" }, code: "SESSION_EXPIRED" },
    { options: { active: false }, code: "EMPLOYEE_INACTIVE" },
    { options: { version: 1 }, code: "SESSION_REVOKED" },
  ])("returns a safe structured guard error: $code", async ({ options, code }) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(now));
    const { t } = await fixture(options);
    await expect(t.query(api.employeeAuth.me, { sessionToken: "device-one" })).rejects.toMatchObject({ data: { code } });
  });

  it("signOut is idempotent and invalid sessions cannot call the wrapper", async () => {
    const { t } = await fixture();
    await t.mutation(api.employeeAuth.signOut, { sessionToken: "device-one" });
    await t.mutation(api.employeeAuth.signOut, { sessionToken: "device-one" });
    await expect(t.query(api.employeeAuth.me, { sessionToken: "device-one" }))
      .rejects.toMatchObject({ data: { code: "SESSION_INVALID" } });
  });

  it("hides corrupt cross-project department links from sign-in and bootstrap DTOs", async () => {
    const { t, employeeId } = await fixture();
    const ownDepartmentId = await t.run(async (ctx) => {
      const projectId = await ctx.db.insert("projects", { name: "Synthetic project A" });
      const otherProjectId = await ctx.db.insert("projects", { name: "Synthetic project B" });
      const foreignDepartmentId = await ctx.db.insert("departments", { projectId: otherProjectId, name: "Foreign department metadata" });
      const ownDepartmentId = await ctx.db.insert("departments", { projectId, name: "Own department" });
      await ctx.db.patch(employeeId, { projectId, departmentId: foreignDepartmentId });
      return ownDepartmentId;
    });
    const bootstrap = await t.query(api.employeeAuth.me, { sessionToken: "device-one" });
    expect(bootstrap).toMatchObject({ departmentId: null, departmentName: null });
    expect(JSON.stringify(bootstrap)).not.toContain("Foreign department metadata");
    const login = await t.mutation(api.employeeAuth.signIn, { email: "mobile@example.test", password: currentPassword });
    if ("error" in login) throw new Error("Expected valid sign-in with a corrupt department link");
    expect(login.employee.departmentId).toBeNull();
    await t.run((ctx) => ctx.db.patch(employeeId, { departmentId: ownDepartmentId }));
    await expect(t.query(api.employeeAuth.me, { sessionToken: "device-one" }))
      .resolves.toMatchObject({ departmentId: ownDepartmentId, departmentName: "Own department" });
  });

  it.each(["password-change", "setup", "logout"] as const)("%s cancels queued legacy-session commands and re-login cannot resurrect them", async (path) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(now));
    const { t, employeeId } = await fixture();
    const { deviceId, doorId } = await t.run(async (ctx) => {
      const projectId = await ctx.db.insert("projects", { name: "Synthetic access project", isActive: true });
      await ctx.db.patch(employeeId, { projectId });
      const deviceId = await ctx.db.insert("devices", {
        projectId, name: "Synthetic panel", brand: "ide_smart", ideUuid: "synthetic-panel",
        ideDoorCount: 1, isActive: true, createdAt: now, updatedAt: now,
      });
      const doorId = await ctx.db.insert("doors", { projectId, deviceId, name: "Synthetic door", ioId: 0, status: "active" });
      const ruleId = await ctx.db.insert("accessRules", { projectId, name: "Monday access", isActive: true, days: ["Monday"] });
      await ctx.db.insert("groupMembers", { projectId, groupId: ruleId, employeeId, createdAt: now });
      await ctx.db.insert("groupDoors", { projectId, groupId: ruleId, deviceId, doorId, createdAt: now });
      return { deviceId, doorId };
    });
    const requestId = "synthetic-queued-request";
    const queued = await t.mutation(api.mobileAccess.requestOpen, { sessionToken: "device-one", requestId, deviceId, doorId });
    const before = await t.query(internal.ideSync.listPendingForBridge, {});
    expect(before.ops).toHaveLength(1);
    const oldCommand = before.ops[0];
    if (!oldCommand) throw new Error("Expected a dispatchable command before revocation");

    if (path === "password-change") {
      await expect(t.mutation(api.employeeAuth.changePassword, { sessionToken: "device-one", currentPassword, newPassword }))
        .resolves.toEqual({ requiresSignIn: true });
    } else if (path === "setup") {
      await expect(t.mutation(internal.employeeAuth.consumeSetupToken, { token: "synthetic-setup", passwordHash: newHash }))
        .resolves.toEqual({ status: "ok" });
    } else {
      await t.mutation(api.employeeAuth.signOut, { sessionToken: "device-one" });
      await expect(t.query(api.employeeAuth.me, { sessionToken: "device-two" })).resolves.toBeDefined();
    }
    expect((await t.query(internal.ideSync.listPendingForBridge, {})).ops).toEqual([]);
    await expect(t.mutation(internal.ideSync.markSent, { opId: oldCommand.opId, msxId: 101 }))
      .rejects.toThrow("MOBILE_COMMAND_NOT_DELIVERABLE");

    const fresh = await t.mutation(api.employeeAuth.signIn, {
      email: "mobile@example.test", password: path === "logout" ? currentPassword : newPassword,
    });
    if ("error" in fresh) throw new Error("Expected re-login after revocation");
    const replay = await t.mutation(api.mobileAccess.requestOpen, { sessionToken: fresh.token, requestId, deviceId, doorId });
    expect(replay.operationId).toBe(queued.operationId);
    expect((await t.query(internal.ideSync.listPendingForBridge, {})).ops).toEqual([]);
    await t.mutation(api.mobileAccess.requestOpen, { sessionToken: fresh.token, requestId: "synthetic-fresh-request", deviceId, doorId });
    const after = await t.query(internal.ideSync.listPendingForBridge, {});
    expect(after.ops).toHaveLength(1);
    expect(after.ops[0]?.opId).not.toBe(oldCommand.opId);
    expect(await t.run((ctx) => ctx.db.query("cardReadings").take(10))).toEqual([]);
  });
});

// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, it } from "vitest";
import schema from "../schema";
import { snapshotEmployeeHikDevices, snapshotRuleHikEmployees, reconcileRemovedEmployeeHik } from "./peopleHikSnapshot";
import { scheduleFingerprintPurge } from "./employeeCardChange";
const modules = Object.fromEntries(Object.entries(import.meta.glob("../**/*.ts")).map(([key, value]) => [key.replace(/^\.\.\//, "./"), value]));

it("skips a person without any device identity in rule removals and does not schedule empty-identity deletes", async () => {
  const t = convexTest(schema, modules);
  await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "A" });
    const employeeId = await ctx.db.insert("employees", { projectId, firstName: "Ada", lastName: "Test", email: "", cardNumber: "", isActive: true });
    const deviceId = await ctx.db.insert("devices", { projectId, name: "Panel", brand: "hikvision", hikDevIndex: "dev", isActive: true, createdAt: "", updatedAt: "" });
    const employee = await ctx.db.get(employeeId);
    if (!employee) throw new Error("Missing fixture");
    const devices = [{ _id: deviceId, name: "Panel", brand: "hikvision" as const, projectId }];
    expect(await snapshotRuleHikEmployees(ctx, [employeeId], projectId)).toEqual(new Map());
    expect(await snapshotRuleHikEmployees(ctx, [employeeId], projectId, devices)).toEqual(new Map());
    expect(await snapshotEmployeeHikDevices(ctx, employee)).toMatchObject({ devices: [] });
    await reconcileRemovedEmployeeHik(ctx, employeeId, { cardNumber: "", projectId, devices });
    expect(await ctx.db.system.query("_scheduled_functions").collect()).toEqual([]);
    await ctx.db.patch(employeeId, { hikEmployeeNo: "device-person" });
    expect((await snapshotRuleHikEmployees(ctx, [employeeId], projectId, devices)).get(employeeId)).toMatchObject({ employeeNo: "device-person", devices });
  });
});

it("purges saved historical fingerprints without manufacturing an identity for unknown enrollment rows", async () => {
  const t = convexTest(schema, modules);
  await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "A" });
    const employeeId = await ctx.db.insert("employees", { projectId, firstName: "Ada", lastName: "Test", email: "", cardNumber: "", isActive: true });
    const deviceId = await ctx.db.insert("devices", { projectId, name: "Panel", brand: "hikvision", isActive: true, createdAt: "", updatedAt: "" });
    const userId = await ctx.db.insert("users", { role: "super_admin" });
    const base = { employeeId, deviceId, projectId, enrolledAt: "now", enrolledBy: userId };
    await ctx.db.insert("deviceFingerprintEnrollments", { ...base, fingerNo: 1 });
    const savedId = await ctx.db.insert("deviceFingerprintEnrollments", { ...base, fingerNo: 2, enrolledEmployeeNo: "historical" });
    await scheduleFingerprintPurge(ctx, employeeId, undefined, { deleteTemplates: true });
    const jobs = await ctx.db.system.query("_scheduled_functions").collect();
    expect(jobs).toHaveLength(1);
    expect(jobs[0].args).toEqual([{ snapshots: [{ enrollmentId: savedId, deviceId, fingerNo: 2, employeeNo: "historical" }] }]);
  });
});

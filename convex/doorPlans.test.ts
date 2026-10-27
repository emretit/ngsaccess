// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import rateLimiterTest from "@convex-dev/rate-limiter/test";
import { describe, expect, it } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import type { Permission, ProjectRole } from "./lib/roleCatalog";

const modules = import.meta.glob("./**/*.ts");
const plan = {
  enabled: true,
  beginTime: "08:00",
  endTime: "18:00",
  mode: "remainOpen" as const,
};
async function setup() {
  const t = convexTest(schema, modules);
  rateLimiterTest.register(t);
  const ids = await t.run(async (ctx) => {
    const projectId = await ctx.db.insert("projects", { name: "Plan projesi" });
    const otherProjectId = await ctx.db.insert("projects", {
      name: "Diğer proje",
    });
    const zoneId = await ctx.db.insert("zones", { projectId, name: "Giriş" });
    const deviceId = await ctx.db.insert("devices", {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      projectId,
      name: "Panel",
      brand: "hikvision",
      hikTransport: "gateway",
      hikIsupOnline: true,
      hikIsupStatusAt: Date.now(),
    });
    const doorId = await ctx.db.insert("doors", {
      projectId,
      deviceId,
      zoneId,
      name: "Ana kapı",
      hikDoorNo: 1,
    });
    const bridgeId = await ctx.db.insert("devices", {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      projectId,
      name: "Köprü",
      brand: "hikvision",
      hikTransport: "localBridge",
    });
    const bridgeDoorId = await ctx.db.insert("doors", {
      projectId,
      deviceId: bridgeId,
      name: "Yerel kapı",
    });
    const otherDeviceId = await ctx.db.insert("devices", {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      projectId: otherProjectId,
      name: "Diğer panel",
      brand: "hikvision",
      hikTransport: "gateway",
    });
    const otherDoorId = await ctx.db.insert("doors", {
      projectId: otherProjectId,
      deviceId: otherDeviceId,
      name: "Diğer kapı",
    });
    const manualDoorId = await ctx.db.insert("doors", {
      projectId,
      name: "Manuel",
    });
    return {
      projectId,
      otherProjectId,
      doorId,
      bridgeDoorId,
      otherDoorId,
      manualDoorId,
    };
  });
  async function member(role: ProjectRole, permissions?: Permission[]) {
    const identity = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        role: "project_user",
        verified: true,
      });
      if (permissions)
        await ctx.db.insert("projectRolePermissions", {
          projectId: ids.projectId,
          role,
          permissions,
          updatedAt: Date.now(),
          updatedBy: userId,
        });
      await ctx.db.insert("userProjects", {
        projectId: ids.projectId,
        userId,
        role,
      });
      const sessionId = await ctx.db.insert("authSessions", {
        userId,
        expirationTime: Date.now() + 86400000,
      });
      return { subject: `${userId}|${sessionId}` };
    });
    return t.withIdentity(identity);
  }
  return { t, ...ids, member };
}
describe("door plans", () => {
  it("accessRules.manage alone saves normalized plans and preserves other fields", async () => {
    const f = await setup();
    const caller = await f.member("technician", ["accessRules.manage"]);
    await caller.mutation(api.doors.updatePlans, {
      doorId: f.doorId,
      hikDoorStatusPlan: plan,
    });
    expect(await f.t.run((ctx) => ctx.db.get(f.doorId))).toMatchObject({
      name: "Ana kapı",
      hikDoorNo: 1,
      hikDoorStatusPlan: {
        ...plan,
        beginTime: "08:00:00",
        endTime: "18:00:00",
      },
    });
  });
  it("devices.manage alone cannot save or list plans", async () => {
    const f = await setup();
    const caller = await f.member("technician", ["devices.manage"]);
    await expect(
      caller.mutation(api.doors.updatePlans, {
        doorId: f.doorId,
        hikDoorStatusPlan: plan,
      }),
    ).rejects.toThrow("Bu işlem için yetkiniz yok");
    expect(
      await caller.query(api.doors.listPlanTargets, { projectId: f.projectId }),
    ).toEqual([]);
    // L4: eski doors.update/create yolları da plan yazamaz; plansız güncelleme sürer.
    await expect(
      caller.mutation(api.doors.update, {
        doorId: f.doorId,
        hikDoorStatusPlan: plan,
      }),
    ).rejects.toThrow("Bu işlem için yetkiniz yok");
    await expect(
      caller.mutation(api.doors.create, {
        name: "Planlı",
        projectId: f.projectId,
        hikDoorStatusPlan: plan,
      }),
    ).rejects.toThrow("Bu işlem için yetkiniz yok");
    await caller.mutation(api.doors.update, { doorId: f.doorId, name: "Yeni ad" });
    const door = await f.t.run((ctx) => ctx.db.get(f.doorId));
    expect(door?.name).toBe("Yeni ad");
    expect(door?.hikDoorStatusPlan).toBeUndefined();
  });
  it("rejects localBridge, manual and other brands", async () => {
    const f = await setup();
    const caller = await f.member("technician");
    for (const doorId of [f.bridgeDoorId, f.manualDoorId])
      await expect(
        caller.mutation(api.doors.updatePlans, {
          doorId,
          hikDoorStatusPlan: plan,
        }),
      ).rejects.toThrow("yalnız Hikvision gateway");
    await f.t.run(async (ctx) => {
      const door = await ctx.db.get(f.doorId);
      if (door?.deviceId)
        await ctx.db.patch(door.deviceId, { brand: "ide_smart" });
    });
    await expect(
      caller.mutation(api.doors.updatePlans, {
        doorId: f.doorId,
        hikDoorStatusPlan: plan,
      }),
    ).rejects.toThrow("yalnız Hikvision gateway");
  });
  it("validates weekly ranges before writing either plan", async () => {
    const f = await setup();
    const caller = await f.member("technician");
    await expect(
      caller.mutation(api.doors.updatePlans, {
        doorId: f.doorId,
        hikDoorStatusPlan: {
          ...plan,
          weekly: [
            {
              day: "Monday",
              segments: [
                { mode: "remainOpen", beginTime: "18:00", endTime: "08:00" },
              ],
            },
          ],
        },
      }),
    ).rejects.toThrow("Başlangıç bitişten önce");
    expect(
      (await f.t.run((ctx) => ctx.db.get(f.doorId)))?.hikDoorStatusPlan,
    ).toBeUndefined();
  });
  it.each(["applyDoorStatusPlan", "applyVerifyPlan"] as const)(
    "%s requires accessRules.manage independently of device management",
    async (action) => {
      const f = await setup();
      const caller = await f.member("technician", ["accessRules.manage"]);
      // Missing gateway registration stops here, before any network request.
      await expect(
        caller.action(api.actions.hikGatewayDevice[action], {
          doorId: f.doorId,
        }),
      ).resolves.toMatchObject({
        ok: false,
        error: expect.stringContaining("kayıtlı değil"),
      });
      await f.t.run(async (ctx) => {
        const override = await ctx.db.query("projectRolePermissions").first();
        if (override)
          await ctx.db.patch(override._id, { permissions: ["devices.manage"] });
      });
      await expect(
        caller.action(api.actions.hikGatewayDevice[action], {
          doorId: f.doorId,
        }),
      ).rejects.toThrow("Bu işlem için yetkiniz yok");
    },
  );
  it("lists only gateway doors in the permitted project, with connection and zone", async () => {
    const f = await setup();
    const caller = await f.member("technician");
    expect(
      await caller.query(api.doors.listPlanTargets, { projectId: f.projectId }),
    ).toMatchObject([
      {
        doorId: f.doorId,
        doorName: "Ana kapı",
        deviceName: "Panel",
        zoneName: "Giriş",
        deviceOnline: true,
        hikDoorStatusPlan: null,
        hikVerifyPlan: null,
      },
    ]);
    expect(
      await caller.query(api.doors.listPlanTargets, {
        projectId: f.otherProjectId,
      }),
    ).toEqual([]);
    await expect(
      caller.mutation(api.doors.updatePlans, {
        doorId: f.otherDoorId,
        hikDoorStatusPlan: plan,
      }),
    ).rejects.toThrow("Bu işlem için yetkiniz yok");
  });
});

describe("phase 2 door plan persistence", () => {
  it("stores weekly verify modes and rejects overlaps atomically", async () => {
    const f = await setup();
    const caller = await f.member("technician");
    const verify = {
      enabled: true,
      beginTime: "08:00",
      endTime: "18:00",
      verifyMode: "card",
      weekly: [
        {
          day: "Monday" as const,
          segments: [
            { beginTime: "09:00:01", endTime: "12:00:02", verifyMode: "face" },
          ],
        },
      ],
    };
    await caller.mutation(api.doors.updatePlans, {
      doorId: f.doorId,
      hikVerifyPlan: verify,
    });
    expect(
      (await f.t.run((ctx) => ctx.db.get(f.doorId)))?.hikVerifyPlan?.weekly,
    ).toEqual(verify.weekly);
    await expect(
      caller.mutation(api.doors.updatePlans, {
        doorId: f.doorId,
        hikVerifyPlan: {
          ...verify,
          weekly: [
            {
              day: "Monday",
              segments: [
                verify.weekly[0].segments[0],
                verify.weekly[0].segments[0],
              ],
            },
          ],
        },
      }),
    ).rejects.toThrow("çakışamaz");
  });
  it("aggregates both server results, retries clear only their own errors and ignores old revisions", async () => {
    const f = await setup();
    const caller = await f.member("technician");
    await caller.mutation(api.doors.updatePlans, {
      doorId: f.doorId,
      hikDoorStatusPlan: plan,
      hikVerifyPlan: {
        enabled: true,
        beginTime: "08:00",
        endTime: "18:00",
        verifyMode: "card",
      },
    });
    await f.t.mutation(internal.doors.recordPlanResult, {
      doorId: f.doorId,
      key: "status",
      revision: 1,
      error: "offline",
    });
    await f.t.mutation(internal.doors.recordPlanResult, {
      doorId: f.doorId,
      key: "verify",
      revision: 1,
    });
    expect(await f.t.run((ctx) => ctx.db.get(f.doorId))).toMatchObject({
      hikPlanApplyError: "offline",
      hikPlanResults: { status: { error: "offline", failedAt: expect.any(String) } },
    });
    const failedTargets = await caller.query(api.doors.listPlanTargets, { projectId: f.projectId });
    expect(failedTargets[0]?.hikPlanFailedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(
      (await f.t.run((ctx) => ctx.db.get(f.doorId)))?.hikPlanAppliedAt,
    ).toBeUndefined();
    await f.t.mutation(internal.doors.recordPlanResult, {
      doorId: f.doorId,
      key: "status",
      revision: 1,
    });
    expect(
      (await f.t.run((ctx) => ctx.db.get(f.doorId)))?.hikPlanAppliedAt,
    ).toBeTruthy();
    await caller.mutation(api.doors.updatePlans, {
      doorId: f.doorId,
      hikDoorStatusPlan: { ...plan, mode: "remainClosed" },
    });
    await f.t.mutation(internal.doors.recordPlanResult, {
      doorId: f.doorId,
      key: "status",
      revision: 1,
      error: "old",
    });
    expect(
      (
        await caller.query(api.doors.listPlanTargets, {
          projectId: f.projectId,
        })
      )[0],
    ).toMatchObject({ plansPending: true, hikPlanApplyError: "Gönderim sırasında plan değişti; yeniden gönderin" });
  });
  it("combines project and national holidays only for selected year and reserves unique slots", async () => {
    const f = await setup();
    const caller = await f.member("technician");
    await f.t.run(async (ctx) => {
      for (const [projectId, date] of [
        [undefined, "2026-01-01"],
        [f.projectId, "2026-01-02"],
        [f.otherProjectId, "2026-01-03"],
        [undefined, "2027-01-01"],
      ] as const)
        await ctx.db.insert("holidays", {
          projectId,
          date,
          name: "Tatil",
          createdAt: "2026-01-01",
        });
    });
    await caller.mutation(api.doors.updatePlans, {
      doorId: f.doorId,
      hikDoorHolidayPlan: { enabled: true, year: 2026, mode: "remainClosed" },
    });
    expect(
      await f.t.query(internal.doors.getPlanHolidays, { doorId: f.doorId }),
    ).toEqual([{ beginDate: "2026-01-01", endDate: "2026-01-02" }]);
    const second = await f.t.run(async (ctx) => {
      const door = await ctx.db.get(f.doorId);
      return ctx.db.insert("doors", {
        projectId: f.projectId,
        deviceId: door?.deviceId,
        name: "İkinci",
      });
    });
    expect(
      await f.t.mutation(internal.doors.reserveHolidaySlots, {
        doorId: f.doorId,
        count: 2,
        max: 3,
      }),
    ).toEqual([1, 2]);
    expect(
      await f.t.mutation(internal.doors.reserveHolidaySlots, {
        doorId: second,
        count: 1,
        max: 3,
      }),
    ).toEqual([3]);
    await expect(
      f.t.mutation(internal.doors.reserveHolidaySlots, {
        doorId: second,
        count: 2,
        max: 3,
      }),
    ).rejects.toThrow("kapasitesi");
  });
});


describe("audit regressions", () => {
  it.each(["number", "device"] as const)("O2 changing door %s clears revision results and device slots", async target => {
    const f = await setup();
    const caller = await f.member("technician");
    const newDeviceId = await f.t.run(async ctx => {
      await ctx.db.patch(f.doorId, { hikDoorStatusPlan: plan, hikPlanRevision: 4, hikPlanSavedAt: "2026-01-01", hikPlanAppliedAt: "2026-01-02", hikPlanResults: { status: { revision: 4, appliedAt: "2026-01-02" } }, hikDoorHolidaySlots: [1, 2] });
      return ctx.db.insert("devices", { projectId: f.projectId, name: "New", brand: "hikvision", hikTransport: "gateway", createdAt: "2026-01-01", updatedAt: "2026-01-01" });
    });
    await caller.mutation(api.doors.update, { doorId: f.doorId, ...(target === "number" ? { hikDoorNo: 2 } : { deviceId: newDeviceId }) });
    const door = await f.t.run(ctx => ctx.db.get(f.doorId));
    expect(door?.hikPlanRevision).toBe(5);
    expect(door?.hikPlanResults).toBeUndefined();
    expect(door?.hikPlanAppliedAt).toBeUndefined();
    expect(door?.hikDoorHolidaySlots).toBeUndefined();
    expect((await caller.query(api.doors.listPlanTargets, { projectId: f.projectId }))[0]).toMatchObject({ plansPending: false, hikPlanAppliedAt: null });
  });
  it.each(["unsent", "failed", "resaved"] as const)("O3 unapplied door plan remains pending when %s", async scenario => {
    const f = await setup();
    const caller = await f.member("technician");
    await caller.mutation(api.doors.updatePlans, { doorId: f.doorId, hikDoorStatusPlan: plan });
    if (scenario !== "unsent") await f.t.mutation(internal.doors.recordPlanResult, { doorId: f.doorId, revision: 1, key: "status", ...(scenario === "failed" ? { error: "offline" } : {}) });
    if (scenario === "resaved") await caller.mutation(api.doors.updatePlans, { doorId: f.doorId, hikDoorStatusPlan: { ...plan, mode: "remainClosed" } });
    expect((await caller.query(api.doors.listPlanTargets, { projectId: f.projectId }))[0].plansPending).toBe(true);
  });
  it("Y1 returns only changed keys and never waits for untouched legacy verify", async () => {
    const f = await setup();
    const caller = await f.member("technician");
    await f.t.run(ctx => ctx.db.patch(f.doorId, { hikVerifyPlan: { enabled: true, beginTime: "08:00", endTime: "18:00", verifyMode: "card" } }));
    expect(await caller.mutation(api.doors.updatePlans, { doorId: f.doorId, hikDoorStatusPlan: plan })).toEqual(["status"]);
    await f.t.mutation(internal.doors.recordPlanResult, { doorId: f.doorId, revision: 1, key: "status" });
    expect((await caller.query(api.doors.listPlanTargets, { projectId: f.projectId }))[0]).toMatchObject({ plansPending: false, hikPlanApplyError: null, hikPlanAppliedAt: expect.any(String) });
    expect(await caller.mutation(api.doors.updatePlans, { doorId: f.doorId, hikDoorStatusPlan: plan })).toEqual([]);
    expect((await f.t.run(ctx => ctx.db.get(f.doorId)))?.hikPlanRevision).toBe(1);
  });
});

it("Y1 changing status retains a successfully applied unchanged verify result", async () => {
  const f = await setup();
  const caller = await f.member("technician");
  await caller.mutation(api.doors.updatePlans, { doorId: f.doorId, hikDoorStatusPlan: plan, hikVerifyPlan: { enabled: true, beginTime: "08:00", endTime: "18:00", verifyMode: "card" } });
  for (const key of ["status", "verify"] as const) await f.t.mutation(internal.doors.recordPlanResult, { doorId: f.doorId, revision: 1, key });
  expect(await caller.mutation(api.doors.updatePlans, { doorId: f.doorId, hikDoorStatusPlan: { ...plan, mode: "remainClosed" } })).toEqual(["status"]);
  expect((await f.t.run(ctx => ctx.db.get(f.doorId)))?.hikPlanResults?.verify).toMatchObject({ revision: 2, appliedAt: expect.any(String) });
  await f.t.mutation(internal.doors.recordPlanResult, { doorId: f.doorId, revision: 2, key: "status" });
  expect((await caller.query(api.doors.listPlanTargets, { projectId: f.projectId }))[0]).toMatchObject({ plansPending: false, hikPlanApplyError: null });
});
it("O4 saving an empty holiday year rejects atomically and excludes other projects", async () => {
  const f = await setup();
  const caller = await f.member("technician");
  await f.t.run(ctx => ctx.db.insert("holidays", { projectId: f.otherProjectId, date: "2099-01-01", name: "Other", createdAt: "2026-01-01" }));
  expect(await caller.query(api.doors.listPlanHolidays, { projectId: f.projectId, year: 2099 })).toEqual([]);
  await expect(caller.mutation(api.doors.updatePlans, { doorId: f.doorId, hikDoorStatusPlan: plan, hikDoorHolidayPlan: { enabled: true, year: 2099, mode: "remainClosed" } })).rejects.toThrow("tatil yok");
  expect((await f.t.run(ctx => ctx.db.get(f.doorId)))?.hikDoorStatusPlan).toBeUndefined();
});

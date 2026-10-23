// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { beforeEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import rateLimiterTest from "@convex-dev/rate-limiter/test";
import schema from "./schema";
import { api, internal } from "./_generated/api";
const mocks = vi.hoisted(() => ({ read: vi.fn(), write: vi.fn() }));
vi.mock("./lib/gateway/core", () => ({
  gatewayApiCall: mocks.read,
  gatewayApiCallChecked: mocks.write,
}));
const modules = import.meta.glob("./**/*.ts");
const flags = {
  isSupportDoorStatusPlan: true,
  isSupportDoorStatusPlanTemplate: true,
  isSupportDoorStatusWeekPlanCfg: true,
  isSupportDoorStatusHolidayPlanCfg: true,
  isSupportDoorStatusHolidayGroupCfg: true,
  isSupportCardReaderPlan: true,
  isSupportVerifyWeekPlanCfg: true,
  isSupportVerifyPlanTemplate: true,
};
beforeEach(() => {
  mocks.write.mockReset().mockResolvedValue({ ok: true });
  mocks.read.mockReset().mockImplementation(async (path: string) => ({
    status: 200,
    raw: "{}",
    data: path.includes("DoorStatusHolidayPlanCfg")
      ? { DoorStatusHolidayPlanCfg: { planNo: { "@max": 16 } } }
      : path.includes("DoorStatusHolidayGroupCfg")
        ? { DoorStatusHolidayGroupCfg: { groupNo: { "@max": 16 } } }
        : { AccessControl: flags },
  }));
});
async function setup(explicitVerifySave = true) {
  const t = convexTest(schema, modules);
  rateLimiterTest.register(t);
  const ids = await t.run(async (ctx) => {
    const projectId = await ctx.db.insert("projects", { name: "Plan" });
    const userId = await ctx.db.insert("users", {
      role: "project_user",
      verified: true,
    });
    await ctx.db.insert("userProjects", {
      userId,
      projectId,
      role: "technician",
    });
    const sessionId = await ctx.db.insert("authSessions", {
      userId,
      expirationTime: Date.now() + 86400000,
    });
    const deviceId = await ctx.db.insert("devices", {
      name: "Panel",
      projectId,
      brand: "hikvision",
      hikTransport: "gateway",
      hikDevIndex: "mock",
      createdAt: "2026-01-01",
      updatedAt: "2026-01-01",
    });
    const doorId = await ctx.db.insert("doors", {
      name: "Kapı",
      projectId,
      deviceId,
      hikDoorNo: 2,
      hikPlanRevision: 1,
      hikPlanSavedAt: "2026-01-01",
      hikDoorStatusPlan: {
        enabled: true,
        beginTime: "08:00",
        endTime: "18:00",
        mode: "remainOpen",
      },
      hikVerifyPlan: {
        enabled: true,
        beginTime: "08:00",
        endTime: "18:00",
        verifyMode: "card",
        weekly: [
          {
            day: "Tuesday",
            segments: [
              {
                beginTime: "09:00:01",
                endTime: "12:00:02",
                verifyMode: "face",
              },
            ],
          },
        ],
      },
      hikDoorHolidayPlan: { enabled: true, year: 2026, mode: "remainClosed" },
    });
    await ctx.db.insert("holidays", {
      date: "2026-10-29",
      name: "Tatil",
      createdAt: "2026-01-01",
    });
    return { doorId, deviceId, caller: { subject: `${userId}|${sessionId}` } };
  });
  const caller = t.withIdentity(ids.caller);
  if (explicitVerifySave) {
    const door = await t.run(ctx => ctx.db.get(ids.doorId));
    await caller.mutation(api.doors.updatePlans, { doorId: ids.doorId, hikVerifyPlan: door?.hikVerifyPlan });
  }
  return { t, ...ids, caller };
}
describe("door plan gateway contract (mock only; not device verified)", () => {
  it.each([undefined, false])("Y1 never unlinks an uninstalled verify plan (%s)", async enabled => {
    const f = await setup();
    await f.t.run(ctx => ctx.db.patch(f.doorId, { hikVerifyPlan: enabled === undefined ? undefined : { enabled, beginTime: "08:00", endTime: "18:00", verifyMode: "card" } }));
    await f.caller.action(api.actions.hikGatewayDevice.applyVerifyPlan, { doorId: f.doorId });
    expect(mocks.write).not.toHaveBeenCalled();
  });
  it.each(["direct", "queue"] as const)("Y1 legacy verify is never sent before an explicit save (%s)", async route => {
    const f = await setup(false);
    if (route === "direct") await f.caller.action(api.actions.hikGatewayDevice.applyVerifyPlan, { doorId: f.doorId });
    else {
      await f.t.run(async ctx => {
        await ctx.db.patch(f.deviceId, { hikLastSeenAt: Date.now() });
        await ctx.db.insert("hikPendingOperations", { deviceId: f.deviceId, operation: "syncVerifyPlan", payload: { doorId: f.doorId }, status: "failed", attemptCount: 0, createdAt: Date.now() });
      });
      await f.t.action(internal.actions.hikQueueWorker.processHikQueue, {});
    }
    expect(mocks.write).not.toHaveBeenCalled();
  });
  it("O1 HEAD status chain keeps working with only the parent capability", async () => {
    const f = await setup();
    await f.t.run(ctx => ctx.db.patch(f.doorId, { hikDoorHolidayPlan: undefined }));
    mocks.read.mockResolvedValue({ status: 200, data: { isSupportDoorStatusPlan: true }, raw: "{}" });
    expect(await f.caller.action(api.actions.hikGatewayDevice.applyDoorStatusPlan, { doorId: f.doorId })).toEqual({ ok: true });
    expect(mocks.write.mock.calls.map(call => call[0])).toEqual([
      "/ISAPI/AccessControl/DoorStatusWeekPlanCfg/2", "/ISAPI/AccessControl/DoorStatusPlanTemplate/102", "/ISAPI/AccessControl/DoorStatusPlan/2",
    ]);
    expect(mocks.write.mock.calls[0][2]).toMatchObject({ DoorStatusWeekPlanCfg: { WeekPlanCfg: expect.arrayContaining([{ week: "Monday", id: 1, enable: true, doorStatus: "remainOpen", TimeSegment: { beginTime: "08:00:00", endTime: "18:00:00" } }]) } });
    expect(mocks.write.mock.calls[2][2]).toEqual({ DoorStatusPlan: { templateNo: 102 } });
  });
  it("O1 distinguishes unreadable capabilities from unsupported features", async () => {
    const f = await setup();
    mocks.read.mockResolvedValue({ status: 503, data: {}, raw: "offline" });
    expect(await f.caller.action(api.actions.hikGatewayDevice.applyDoorStatusPlan, { doorId: f.doorId })).toMatchObject({ ok: false, error: expect.stringContaining("yeteneği okunamadı") });
    expect(mocks.write).not.toHaveBeenCalled();
  });
  it("O4 holiday end has the same midnight resolution as weekly plans", async () => {
    const f = await setup();
    await f.caller.action(api.actions.hikGatewayDevice.applyDoorStatusPlan, { doorId: f.doorId });
    expect(mocks.write.mock.calls[0][2]).toMatchObject({ DoorStatusHolidayPlanCfg: { HolidayPlanCfg: expect.arrayContaining([expect.objectContaining({ id: 1, TimeSegment: { beginTime: "00:00:00", endTime: "24:00:00" } })]) } });
  });
  it("O4 rejects empty holiday years before any write or reservation", async () => {
    const f = await setup();
    await f.t.run(ctx => ctx.db.patch(f.doorId, { hikDoorHolidayPlan: { enabled: true, year: 2099, mode: "remainClosed" } }));
    expect(await f.caller.action(api.actions.hikGatewayDevice.applyDoorStatusPlan, { doorId: f.doorId })).toMatchObject({ ok: false, error: expect.stringContaining("tatil yok") });
    expect(mocks.write).not.toHaveBeenCalled();
    expect((await f.t.run(ctx => ctx.db.get(f.doorId)))?.hikDoorHolidaySlots).toBeUndefined();
  });
  it.each([{}, { isSupportDoorStatusPlan: true }])("O1 HEAD status accepts absent legacy child flags %j", async capabilities => {
    const f = await setup();
    await f.t.run(ctx => ctx.db.patch(f.doorId, { hikDoorHolidayPlan: undefined }));
    mocks.read.mockResolvedValue({ status: 200, data: capabilities, raw: "{}" });
    expect(await f.caller.action(api.actions.hikGatewayDevice.applyDoorStatusPlan, { doorId: f.doorId })).toEqual({ ok: true });
    expect(mocks.write).toHaveBeenCalledTimes(3);
  });
  it.each(["isSupportDoorStatusPlan", "isSupportDoorStatusWeekPlanCfg", "isSupportDoorStatusPlanTemplate"])("O1 explicit false still blocks %s", async field => {
    const f = await setup();
    mocks.read.mockResolvedValue({ status: 200, data: { ...flags, [field]: false }, raw: "{}" });
    expect(await f.caller.action(api.actions.hikGatewayDevice.applyDoorStatusPlan, { doorId: f.doorId })).toMatchObject({ ok: false });
    expect(mocks.write).not.toHaveBeenCalled();
  });
  it.each([{}, { isSupportCardRightWeekPlanCfg: true }, { isSupportVerifyPlanTemplate: true }])("O1 verify accepts documented implied or alias support %j", async extra => {
    const f = await setup();
    mocks.read.mockResolvedValue({ status: 200, data: { isSupportCardReaderPlan: true, ...extra }, raw: "{}" });
    expect(await f.caller.action(api.actions.hikGatewayDevice.applyVerifyPlan, { doorId: f.doorId })).toEqual({ ok: true });
    expect(mocks.write).toHaveBeenCalledTimes(3);
  });
  it("O1 explicit verify false takes precedence over the weekly alias", async () => {
    const f = await setup();
    mocks.read.mockResolvedValue({ status: 200, data: { ...flags, isSupportVerifyWeekPlanCfg: false, isSupportCardRightWeekPlanCfg: true }, raw: "{}" });
    expect(await f.caller.action(api.actions.hikGatewayDevice.applyVerifyPlan, { doorId: f.doorId })).toMatchObject({ ok: false });
    expect(mocks.write).not.toHaveBeenCalled();
  });
  it("Y1 factory template match is not proof that this app installed a disabled plan", async () => {
    const f = await setup();
    await f.t.run(async ctx => {
      const door = await ctx.db.get(f.doorId);
      await ctx.db.insert("readers", { projectId: door?.projectId, doorId: f.doorId, deviceId: f.deviceId, name: "Factory", createdAt: "2026-01-01", updatedAt: "2026-01-01", direction: "entry", hikReaderNo: 3, hikCardReaderPlanTemplateNo: 3 });
      await ctx.db.patch(f.doorId, { hikVerifyPlan: { enabled: false, beginTime: "08:00", endTime: "18:00", verifyMode: "card" } });
    });
    await f.caller.action(api.actions.hikGatewayDevice.applyVerifyPlan, { doorId: f.doorId });
    expect(mocks.write).not.toHaveBeenCalled();
  });
  it("Y1 a partial install only authorizes unlinking successfully bound readers", async () => {
    const f = await setup();
    await f.t.run(async ctx => {
      const door = await ctx.db.get(f.doorId);
      for (const hikReaderNo of [3, 4]) await ctx.db.insert("readers", { projectId: door?.projectId, doorId: f.doorId, deviceId: f.deviceId, name: `Reader ${hikReaderNo}`, createdAt: "2026-01-01", updatedAt: "2026-01-01", direction: "entry", hikReaderNo });
    });
    mocks.write.mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce({ ok: false, error: "offline" });
    expect(await f.caller.action(api.actions.hikGatewayDevice.applyVerifyPlan, { doorId: f.doorId })).toMatchObject({ ok: false });
    expect((await f.t.run(ctx => ctx.db.get(f.doorId)))?.hikVerifyPlanReaderNos).toEqual([3]);
    await f.caller.mutation(api.doors.updatePlans, { doorId: f.doorId, hikVerifyPlan: { enabled: false, beginTime: "08:00", endTime: "18:00", verifyMode: "card" } });
    mocks.write.mockClear();
    expect(await f.caller.action(api.actions.hikGatewayDevice.applyVerifyPlan, { doorId: f.doorId })).toEqual({ ok: true });
    expect(mocks.write.mock.calls.map(call => [call[0], call[2]])).toEqual([["/ISAPI/AccessControl/CardReaderPlan/3", { CardReaderPlan: { templateNo: 0 } }]]);
    expect((await f.t.run(ctx => ctx.db.get(f.doorId)))?.hikVerifyPlanReaderNos).toEqual([]);
    mocks.write.mockClear();
    await f.caller.action(api.actions.hikGatewayDevice.applyVerifyPlan, { doorId: f.doorId });
    expect(mocks.write).not.toHaveBeenCalled();
  });
  it("writes dated holiday plans, CSV group and template link in order", async () => {
    const f = await setup();
    expect(
      await f.caller.action(api.actions.hikGatewayDevice.applyDoorStatusPlan, {
        doorId: f.doorId,
      }),
    ).toEqual({ ok: true });
    expect(mocks.write.mock.calls.map((call) => call[0])).toEqual([
      "/ISAPI/AccessControl/DoorStatusHolidayPlanCfg/1",
      "/ISAPI/AccessControl/DoorStatusHolidayGroupCfg/2",
      "/ISAPI/AccessControl/DoorStatusWeekPlanCfg/2",
      "/ISAPI/AccessControl/DoorStatusPlanTemplate/102",
      "/ISAPI/AccessControl/DoorStatusPlan/2",
    ]);
    expect(mocks.write.mock.calls[0][2]).toMatchObject({
      DoorStatusHolidayPlanCfg: {
        beginDate: "2026-10-29",
        endDate: "2026-10-29",
        HolidayPlanCfg: [
          {
            id: 1,
            enable: true,
            doorStatus: "remainClosed",
            TimeSegment: { beginTime: "00:00:00", endTime: "24:00:00" },
          },
          ...Array.from({ length: 7 }, (_, i) => ({
            id: i + 2,
            enable: false,
          })),
        ],
      },
    });
    expect(mocks.write.mock.calls[1][2]).toEqual({
      DoorStatusHolidayGroupCfg: {
        enable: true,
        groupName: "NGS 2",
        holidayPlanNo: "1",
      },
    });
    expect(mocks.write.mock.calls[3][2]).toEqual({
      DoorStatusPlanTemplate: {
        enable: true,
        templateName: "NGS 102",
        weekPlanNo: 2,
        holidayGroupNo: "2",
      },
    });
  });
  it.each([false, undefined])(
    "sends no PUT when holiday capability is %s and records error",
    async (support) => {
      const f = await setup();
      mocks.read.mockResolvedValue({
        status: 200,
        raw: "{}",
        data: {
          AccessControl: {
            ...flags,
            isSupportDoorStatusHolidayPlanCfg: support,
          },
        },
      });
      expect(
        await f.caller.action(
          api.actions.hikGatewayDevice.applyDoorStatusPlan,
          { doorId: f.doorId },
        ),
      ).toMatchObject({
        ok: false,
        error: "Bu cihaz tatil planını desteklemiyor",
      });
      expect(mocks.write).not.toHaveBeenCalled();
      expect(
        (await f.t.run((ctx) => ctx.db.get(f.doorId)))?.hikPlanApplyError,
      ).toBe("Bu cihaz tatil planını desteklemiyor");
    },
  );
  it("stops after a failed holiday write and persists thrown network errors", async () => {
    const f = await setup();
    mocks.write.mockRejectedValueOnce(new Error("network down"));
    expect(
      await f.caller.action(api.actions.hikGatewayDevice.applyDoorStatusPlan, {
        doorId: f.doorId,
      }),
    ).toMatchObject({ ok: false, error: "network down" });
    expect(mocks.write).toHaveBeenCalledTimes(1);
    expect(
      (await f.t.run((ctx) => ctx.db.get(f.doorId)))?.hikPlanApplyError,
    ).toBe("network down");
  });
  it("sends weekly verify segments and binds the actual reader (door 2 → reader 3)", async () => {
    const f = await setup();
    expect(
      await f.caller.action(api.actions.hikGatewayDevice.applyVerifyPlan, {
        doorId: f.doorId,
      }),
    ).toEqual({ ok: true });
    expect(mocks.write.mock.calls.map((call) => call[0])).toEqual([
      "/ISAPI/AccessControl/VerifyWeekPlanCfg/3",
      "/ISAPI/AccessControl/VerifyPlanTemplate/3",
      "/ISAPI/AccessControl/CardReaderPlan/3",
    ]);
    expect(mocks.write.mock.calls[0][2]).toMatchObject({
      VerifyWeekPlanCfg: {
        WeekPlanCfg: expect.arrayContaining([
          {
            week: "Tuesday",
            id: 1,
            enable: true,
            verifyMode: "face",
            TimeSegment: { beginTime: "09:00:01", endTime: "12:00:02" },
          },
          {
            week: "Monday",
            id: 1,
            enable: false,
            verifyMode: "card",
            TimeSegment: { beginTime: "00:00:00", endTime: "00:00:00" },
          },
        ]),
      },
    });
    expect(mocks.write.mock.calls[2][2]).toEqual({
      CardReaderPlan: { templateNo: 3 },
    });
    expect(
      (await f.t.run((ctx) => ctx.db.get(f.doorId)))?.hikPlanAppliedAt,
    ).toBeUndefined();
    await f.caller.action(api.actions.hikGatewayDevice.applyDoorStatusPlan, {
      doorId: f.doorId,
    });
    expect(
      (await f.t.run((ctx) => ctx.db.get(f.doorId)))?.hikPlanAppliedAt,
    ).toBeTruthy();
  });
  it("disables via template 0, detaches holidays without rewriting old slots", async () => {
    const f = await setup();
    await f.caller.action(api.actions.hikGatewayDevice.applyVerifyPlan, { doorId: f.doorId });
    mocks.write.mockClear();
    await f.t.run((ctx) =>
      ctx.db.patch(f.doorId, {
        hikDoorHolidayPlan: {
          enabled: false,
          year: 2026,
          mode: "remainClosed",
        },
        hikVerifyPlan: {
          enabled: false,
          beginTime: "08:00",
          endTime: "18:00",
          verifyMode: "card",
        },
      }),
    );
    await f.caller.action(api.actions.hikGatewayDevice.applyVerifyPlan, {
      doorId: f.doorId,
    });
    expect(mocks.write.mock.calls[0][2]).toEqual({
      CardReaderPlan: { templateNo: 0 },
    });
    mocks.write.mockClear();
    await f.caller.action(api.actions.hikGatewayDevice.applyDoorStatusPlan, {
      doorId: f.doorId,
    });
    expect(
      mocks.write.mock.calls.some((call) => call[0].includes("Holiday")),
    ).toBe(false);
    expect(mocks.write.mock.calls[1][2]).toMatchObject({
      DoorStatusPlanTemplate: { holidayGroupNo: "" },
    });
  });
  it("rejects unknown holiday capacity before any PUT", async () => {
    const f = await setup();
    mocks.read.mockImplementation(async (path: string) => ({
      status: 200,
      raw: "{}",
      data: path === "/ISAPI/AccessControl/capabilities" ? flags : {},
    }));
    expect(
      await f.caller.action(api.actions.hikGatewayDevice.applyDoorStatusPlan, {
        doorId: f.doorId,
      }),
    ).toMatchObject({ ok: false });
    expect(mocks.write).not.toHaveBeenCalled();
  });
  it.each(["syncDoorStatusPlan", "syncVerifyPlan"] as const)(
    "queue %s uses the same weekly/holiday and result path",
    async (operation) => {
      const f = await setup();
      await f.t.run(async (ctx) => {
        await ctx.db.patch(f.deviceId, { hikLastSeenAt: Date.now() });
        await ctx.db.insert("hikPendingOperations", {
          deviceId: f.deviceId,
          operation,
          payload: { doorId: f.doorId },
          status: "failed",
          attemptCount: 0,
          createdAt: Date.now(),
        });
      });
      expect(
        await f.t.action(internal.actions.hikQueueWorker.processHikQueue, {}),
      ).toEqual({ retried: 1, ok: 1, failed: 0 });
      const door = await f.t.run((ctx) => ctx.db.get(f.doorId));
      expect(
        operation === "syncDoorStatusPlan"
          ? door?.hikPlanResults?.status?.appliedAt
          : door?.hikPlanResults?.verify?.appliedAt,
      ).toBeTruthy();
      expect(mocks.write.mock.calls.map((call) => call[0])).toContain(
        operation === "syncDoorStatusPlan"
          ? "/ISAPI/AccessControl/DoorStatusHolidayPlanCfg/1"
          : "/ISAPI/AccessControl/CardReaderPlan/3",
      );
    },
  );
});
